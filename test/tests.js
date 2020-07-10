const BN = require('bn.js');
const chai = require('chai');

chai.use(require('chai-bn')(BN));

const {expect} = chai;

const {time} = require('@openzeppelin/test-helpers');
const {errors} = require('./helpers');
const {assert} = require('chai');

const aTokenMockup = artifacts.require('aTokenMockup');
const MagicBet = artifacts.require('MBMarket');
const MagicBetFactory = artifacts.require('MBMarketFactory');
const Token = artifacts.require('Token');
const DaiMockup = artifacts.require('DaiMockup');
const RealitioMockup = artifacts.require('RealitioMockup.sol');
const UniswapMockup = artifacts.require('UniswapMockup.sol');

const NON_OCCURING = 0;
const OCCURING = 1;

const stake0 = 200;
const stake1 = 300;
const stake2 = 500;
const stake3 = 100;
const stake4 = 400;

let aToken, token1, token2, dai, magicBet, magicBetFactory, uniswap, realitio, user0, user1, user2, user3, user4;

contract('MagicBetTests', (accounts) => {
  user0 = accounts[0];
  user1 = accounts[1];
  user2 = accounts[2];
  user3 = accounts[3];
  user4 = accounts[4];

  beforeEach(async () => {
    dai = await DaiMockup.new();
    aToken = await aTokenMockup.new(dai.address);
    realitio = await RealitioMockup.new();
    uniswap = await UniswapMockup.new();
    magicBetFactory = await MagicBetFactory.new(
      dai.address,
      aToken.address,
      aToken.address,
      aToken.address,
      realitio.address,
      uniswap.address
    );
    await createMarket(
      'Who will win the 2020 US General Election',
      'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US',
      ['Trump', 'Biden']
    );
  });

  async function createMarket(eventName, question, outcomeNames) {
    const arbitrator = '0x34A971cA2fd6DA2Ce2969D716dF922F17aAA1dB0';
    const marketOpeningTime = (await time.latest()).toNumber() + 100;
    const marketLockingTime = marketOpeningTime + 100;
    const marketResolutionTime = marketLockingTime + 100;
    await magicBetFactory.createMarket(
      eventName,
      marketOpeningTime,
      marketLockingTime,
      marketResolutionTime,
      30,
      arbitrator,
      question,
      outcomeNames
    );
    const marketAddress = await magicBetFactory.marketAddresses.call(0);
    magicBet = await MagicBet.at(marketAddress);
  }

  it('betting leads to winners receiving both stake and interest, losers receiving their stake back; check ERC20s are minted and then destroyed; check cant withdraw twice', async () => {
    await time.increase(time.duration.seconds(100));
    await placeBet(user0, NON_OCCURING, stake0);
    await placeBet(user1, NON_OCCURING, stake1);
    await placeBet(user2, NON_OCCURING, stake2);
    await placeBet(user2, OCCURING, stake3);
    await placeBet(user3, OCCURING, stake4);
    const totalStake = stake0 + stake1 + stake2 + stake3 + stake4;
    const totalWinningStake = stake3 + stake4;

    // check that ERC20s are minted
    await initialiseERC20s();

    expect(asWeiBN(stake0)).to.be.bignumber.equal(await token1.balanceOf(user0));
    expect(asWeiBN(stake1)).to.be.bignumber.equal(await token1.balanceOf(user1));
    expect(asWeiBN(stake2)).to.be.bignumber.equal(await token1.balanceOf(user2));
    expect(asWeiBN(stake3)).to.be.bignumber.equal(await token2.balanceOf(user2));
    expect(asWeiBN(stake4)).to.be.bignumber.equal(await token2.balanceOf(user3));

    await letOutcomeOccur();

    // check returned deposit + winnings for user2 and user3
    let userResult = await withdrawAndReturnActualAndExpectedBalance(
      user2,
      stake3,
      stake2,
      totalStake,
      totalWinningStake
    ); // user/staked on winning/staked on losing
    assert.equal(userResult.actualBalance, userResult.expectedBalance);
    userResult = await withdrawAndReturnActualAndExpectedBalance(user3, stake4, 0, totalStake, totalWinningStake);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);

    // check returned deposit for losers user0 and user1
    userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0, totalStake, totalWinningStake);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);
    userResult = await withdrawAndReturnActualAndExpectedBalance(user1, 0, stake1, totalStake, totalWinningStake);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);

    // check total bets and withdrawn bets
    assert.equal(await magicBet.totalBets.call(), asWei(totalStake));
    assert.equal(await magicBet.betsWithdrawn.call(), asWei(totalStake));

    // check that cant withdraw twice
    assert.equal(await resetAndWithdrawBalance(user0), 0);
    assert.equal(await resetAndWithdrawBalance(user1), 0);
    assert.equal(await resetAndWithdrawBalance(user2), 0);
    assert.equal(await resetAndWithdrawBalance(user3), 0);

    // check that nothing is withdrawn if you didnt bet
    userResult = await withdrawAndReturnActualAndExpectedBalance(user4, 0, 0, totalStake, totalWinningStake);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);

    // check that ERC20s have been burnt
    const zero = new BN(0);
    expect(zero).to.be.bignumber.equal(await token1.balanceOf(user0));
    expect(zero).to.be.bignumber.equal(await token1.balanceOf(user1));
    expect(zero).to.be.bignumber.equal(await token1.balanceOf(user2));
    expect(zero).to.be.bignumber.equal(await token2.balanceOf(user2));
    expect(zero).to.be.bignumber.equal(await token2.balanceOf(user3));
  });

  async function resetAndWithdrawBalance(user) {
    await dai.resetBalance(user);
    await magicBet.withdraw({from: user});
    const userBalance = await dai.balanceOf(user);
    return userBalance;
  }

  it('check market states transition', async () => {
    const marketStates = Object.freeze({WAITING: 0, OPEN: 1, LOCKED: 2, WITHDRAW: 3});
    // opening date in the future, so revert;  no need to increment state cos automatic within
    // the placeBet function via the checkState modifier
    expect((await magicBet.getCurrentState()).toNumber()).to.equal(marketStates.WAITING);
    await expect(placeBet(user0, NON_OCCURING, stake0), errors.incorrectState).to.be.reverted;
    // progress time so opening is in the past, should not revert
    await time.increase(time.duration.seconds(150));
    await placeBet(user0, NON_OCCURING, stake0);
    expect((await magicBet.getCurrentState()).toNumber()).to.equal(marketStates.OPEN);
    // it should change it if i progress another 100 seconds
    await time.increase(time.duration.seconds(100));
    expect((await magicBet.getCurrentState()).toNumber()).to.equal(marketStates.LOCKED);
    // withdraw fail; too early
    await expect(magicBet.withdraw({from: user0}), errors.incorrectState).to.be.reverted; // too early
    // determine winner then end
    await realitio.setResult(OCCURING);
    await magicBet.determineWinner();
    expect((await magicBet.getCurrentState()).toNumber()).to.equal(marketStates.WITHDRAW);
    await magicBet.withdraw({from: user0}); // should succeed now
    await expect(placeBet(user0, OCCURING, stake1), errors.incorrectState).to.be.reverted;
  });

  it('one user betting multiple times receives all stake plus total interest', async () => {
    const totalLosingStake = stake0 + stake1 + stake2;
    const totalStake = stake0 + stake1 + stake2 + stake3 + stake4;
    const totalWinningStake = stake3 + stake4;
    await time.increase(time.duration.seconds(100));

    await placeBet(user0, NON_OCCURING, stake0);
    await placeBet(user0, NON_OCCURING, stake1);
    await placeBet(user0, NON_OCCURING, stake2);
    await placeBet(user0, OCCURING, stake3);
    await placeBet(user0, OCCURING, stake4);

    await letOutcomeOccur();

    const userResult = await withdrawAndReturnActualAndExpectedBalance(
      user0,
      totalWinningStake,
      totalLosingStake,
      totalStake,
      totalWinningStake
    );
    assert.equal(userResult.actualBalance, userResult.expectedBalance);
  });

  it('payout all stakes plus interest in case of winning outcome does not exist', async () => {
    // = users have a choice of 0 and 1, but 2 wins
    const totalStake = stake0 + stake1;
    const totalWinningStake = stake1;
    await time.increase(time.duration.seconds(100));

    await placeBet(user0, NON_OCCURING, stake0);
    await placeBet(user1, OCCURING, stake1);
    const invalidOutcome = OCCURING + 1;
    await letOutcomeOccur(invalidOutcome);

    let userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
    userResult = await withdrawAndReturnActualAndExpectedBalance(user1, stake1, 0, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
  });

  it('payout stake plus interest in case of no winner', async () => {
    const totalStake = stake0;
    const totalWinningStake = 0;
    const expectedInterest = asWeiBN(totalStake / 10);
    await time.increase(time.duration.seconds(100));
    await placeBet(user0, NON_OCCURING, stake0);
    await letOutcomeOccur();
    let totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);

    const userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
  });

  it('payout all stakes plus interest after 1 month in case of Oracle never resolves', async () => {
    // = users have a choice of 0 and 1, but 2 wins
    const totalStake = stake0 + stake1;
    const totalWinningStake = stake1;
    // await prepareForBetting();
    await time.increase(time.duration.seconds(100));
    await placeBet(user0, 0, stake0); // 200
    await placeBet(user1, 1, stake1); // 300
    await aToken.generate10PercentInterest(magicBet.address);

    // havnt waited a month so this should fail:
    await expect(magicBet.withdraw({from: user0}), errors.incorrectState).to.be.reverted;

    // pass time by a month and try again
    await time.increase(time.duration.weeks(5));
    let userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
    userResult = await withdrawAndReturnActualAndExpectedBalance(user1, 0, stake1, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
  });

  it("can't determine winner if oracle has not yet resolved", async () => {
    await time.increase(time.duration.seconds(100));
    await placeBet(user0, NON_OCCURING, stake0);
    await expect(magicBet.determineWinner(), errors.oracleNotFinalised).to.be.reverted;
  });

  it('check getTotalInterest', async () => {
    await time.increase(time.duration.seconds(100));
    await placeBet(user0, NON_OCCURING, stake0);
    await placeBet(user1, OCCURING, stake1);
    await placeBet(user2, OCCURING, stake2);
    // total interest should be zero
    let totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
    await letOutcomeOccur();
    // interest should be 10% of total stake
    const totalStake = stake0 + stake1 + stake2;
    let expectedInterest = asWeiBN(totalStake / 10);
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    // loser withdraws, total interest should be unchanged
    await magicBet.withdraw({from: user0});
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    // one of the winners withdraws, should be drop in interest
    await magicBet.withdraw({from: user1});
    expectedInterest = asWeiBN(((totalStake / 10) * stake2) / (stake1 + stake2));
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    //final withdrawal, should be no interest left
    await magicBet.withdraw({from: user2});
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
  });

  it('check getTotalInterest but interest increases between withdrawals', async () => {
    await time.increase(time.duration.seconds(100));
    await placeBet(user0, NON_OCCURING, stake0); //200
    await placeBet(user1, OCCURING, stake1); //300
    await placeBet(user2, OCCURING, stake2); //500
    // total interest should be zero
    let totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
    await letOutcomeOccur();
    // interest should be 10% of total stake
    let totalStake = stake0 + stake1 + stake2; //1000
    totalInterest = await magicBet.getTotalInterest();
    let expectedInterest = asWeiBN(totalStake / 10);
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    // loser withdraws, total interest should be unchanged
    await magicBet.withdraw({from: user0}); //1100 - 200 = 900 left
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    // interest increases by 10%, total -> 990, interest = 190
    await aToken.generate10PercentInterest(magicBet.address);
    totalInterest = await magicBet.getTotalInterest();
    expectedInterest = asWeiBN(190);
    // user1 withdraws, should get 190 * 300/800 interest which leaves 71.25 interest
    await magicBet.withdraw({from: user1});
    totalInterest = await magicBet.getTotalInterest();
    expectedInterest = asWeiBN(71.25);
    // increase interest and final user withdraws, should be zero interest left.
    await aToken.generate10PercentInterest(magicBet.address);
    await magicBet.withdraw({from: user2});
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
  });

  it('check getMaxTotalInterest', async () => {
    await time.increase(time.duration.seconds(100));
    await placeBet(user0, NON_OCCURING, stake0); //200
    await placeBet(user1, OCCURING, stake1); //300
    await placeBet(user2, OCCURING, stake2); //500
    // increase interest and check that getMax increases with it
    await aToken.generate10PercentInterest(magicBet.address);
    let totalInterest = await magicBet.getTotalInterest();
    let maxInterest = await magicBet.getMaxTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(maxInterest);
    // again
    await aToken.generate10PercentInterest(magicBet.address);
    totalInterest = await magicBet.getTotalInterest();
    maxInterest = await magicBet.getMaxTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(maxInterest);
    // resolve, get final interest amount
    await letOutcomeOccur();
    const actualMaxInterest = await magicBet.getTotalInterest();
    // withdraw, maxInterest should not reduce
    await magicBet.withdraw({from: user1});
    maxInterest = await magicBet.getMaxTotalInterest();
    expect(actualMaxInterest).to.be.bignumber.equal(maxInterest);
  });

  it('create ten markets, do simple invalid outcome check on final one', async () => {
    let i;
    for (i = 0; i < 10; i++) {
      await createMarket(
        'Who will win the 2020 US General Election',
        'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US',
        ['Trump', 'Biden']
      );
    }

    const marketAddress = await magicBetFactory.marketAddresses.call(10);
    magicBet = await MagicBet.at(marketAddress);
    const totalStake = stake0;
    const totalWinningStake = 0;
    const expectedInterest = asWeiBN(totalStake / 10);
    await time.increase(time.duration.seconds(100));
    await placeBet(user0, NON_OCCURING, stake0);
    await letOutcomeOccur();
    let totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);

    const userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
  });

  it('event with three outcomes', async () => {
    await createMarket(
      'Who will win the 2020 US General Election',
      'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden", "Kanye West"␟news-politics␟en_US',
      ['Trump', 'Biden', 'West']
    );
    const marketAddress = await magicBetFactory.marketAddresses.call(1);
    magicBet = await MagicBet.at(marketAddress);
    const totalStake = stake0 + stake1 + stake2;
    const donaldTrump = 0;
    const joeBiden = 1;
    const kanyeWest = 2;

    await time.increase(time.duration.seconds(100));
    await placeBet(user0, donaldTrump, stake0);
    await placeBet(user1, joeBiden, stake1);
    await placeBet(user2, kanyeWest, stake2);

    await letOutcomeOccur(kanyeWest);

    let userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0, totalStake, stake2, 3);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);

    userResult = await withdrawAndReturnActualAndExpectedBalance(user1, 0, stake1, totalStake, stake2, 3);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);

    userResult = await withdrawAndReturnActualAndExpectedBalance(user2, stake2, 0, totalStake, stake2, 3);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);
  });

  async function letOutcomeOccur(eventOutcome = OCCURING) {
    await aToken.generate10PercentInterest(magicBet.address);
    await realitio.setResult(eventOutcome);
    await magicBet.determineWinner();
    await time.increase(time.duration.seconds(100));
  }

  async function placeBet(user, outcome, stake) {
    await dai.mint(asWei(stake), {from: user});
    await magicBet.placeBet(outcome, asWei(stake), {
      from: user,
    });
  }

  async function initialiseERC20s() {
    const tokenAddresses = await magicBet.getTokenAddresses.call();
    token1 = await Token.at(tokenAddresses[0]);
    token2 = await Token.at(tokenAddresses[1]);
  }

  async function withdrawAndReturnActualAndExpectedBalance(
    _user,
    _stakeOnWinning,
    _stakeOnLosing,
    _totalStake,
    _totalWinningStake,
    _outcomeCount = 2
  ) {
    await magicBet.withdraw({
      from: _user,
    });
    const actualBalance = await dai.balanceOf(_user);
    let expectedBalance = _stakeOnWinning + _stakeOnLosing;
    const outcome = await magicBet.winningOutcome();
    const invalidOutcome = outcome < 0 || outcome >= _outcomeCount;

    if (_stakeOnWinning > 0 || _totalWinningStake == 0 || invalidOutcome) {
      const totalInterest = _totalStake * 0.1;
      let shareOfInterest;
      if (_totalWinningStake == 0 || invalidOutcome) {
        shareOfInterest = (expectedBalance / _totalStake) * totalInterest;
      } else {
        shareOfInterest = (_stakeOnWinning / _totalWinningStake) * totalInterest;
      }
      expectedBalance += shareOfInterest;
    }
    return {
      actualBalance: actualBalance.toString(),
      expectedBalance: asWei(expectedBalance).toString(),
    };
  }

  function asWeiBN(amount) {
    return new BN(asWei(amount));
  }

  function asWei(amount) {
    return web3.utils.toWei(amount.toString(), 'ether');
  }
});
