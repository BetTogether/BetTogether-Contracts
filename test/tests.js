const BN = require('bn.js');
const chai = require('chai');
const chaiBN = require('chai-bn');

chai.use(chaiBN(BN));

const {expect} = chai;

const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {errors} = require('./helpers');

const aTokenMockup = artifacts.require('aTokenMockup');
const MagicBet = artifacts.require('MBMarket');
const MagicBetFactory = artifacts.require('MBMarketFactory');
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

let aToken;
let dai;
let magicBet;
let magicBetFactory;
let uniswap;
let realitio;
let user0;
let user1;
let user2;
let user3;
// let user4;
// let user5;
// let user6;
// let user7;
// let user8;

contract('MagicBetTests', (accounts) => {
  user0 = accounts[0];
  user1 = accounts[1];
  user2 = accounts[2];
  user3 = accounts[3];
  // user4 = accounts[4];
  // user5 = accounts[5];
  // user6 = accounts[6];
  // user7 = accounts[7];
  // user8 = accounts[8];

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
  }

  it('betting leads to winners receiving both stake and interest, losers receiving their stake back', async () => {
    await prepareForBetting();
    await placeBet(user0, NON_OCCURING, stake0);

    await placeBet(user1, NON_OCCURING, stake1);
    await placeBet(user2, NON_OCCURING, stake2);
    await placeBet(user2, OCCURING, stake3);
    await placeBet(user3, OCCURING, stake4);
    const totalStake = stake0 + stake1 + stake2 + stake3 + stake4;
    const totalWinningStake = stake3 + stake4;

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

    // check totalBets and betsWithdrawn
    const totalBets = await magicBet.totalBets.call();
    assert.equal(totalBets, web3.utils.toWei(totalStake.toString(), 'ether'));
    const betsWithdrawn = await magicBet.betsWithdrawn.call();
    assert.equal(betsWithdrawn, web3.utils.toWei(totalStake.toString(), 'ether'));
  });

  it('check market states transition', async () => {
    const marketAddress = await magicBetFactory.marketAddresses.call(0);
    magicBet = await MagicBet.at(marketAddress);
    const marketStates = Object.freeze({WAITING: 0, OPEN: 1, LOCKED: 2, WITHDRAW: 3});
    // opening date in the future, so revert;  no need to increment state cos automatic within
    // the placeBet function via the checkState modifier
    expect((await magicBet.getCurrentState()).toNumber()).to.equal(marketStates.WAITING);
    await expectRevert(placeBet(user0, NON_OCCURING, stake0), errors.incorrectState);
    // progress time so opening is in the past, should not revert
    await time.increase(time.duration.seconds(150));
    await placeBet(user0, NON_OCCURING, stake0);
    expect((await magicBet.getCurrentState()).toNumber()).to.equal(marketStates.OPEN);
    // it should change it if i progress another 100 seconds
    await time.increase(time.duration.seconds(100));
    expect((await magicBet.getCurrentState()).toNumber()).to.equal(marketStates.LOCKED);
    // withdraw fail; too early
    await expectRevert(magicBet.withdraw({from: user0}), errors.incorrectState); // too early
    // determine winner then end
    await realitio.setResult(OCCURING);
    await magicBet.determineWinner();
    expect((await magicBet.getCurrentState()).toNumber()).to.equal(marketStates.WITHDRAW);
    await magicBet.withdraw({from: user0}); // should succeed now
    await expectRevert(placeBet(user0, OCCURING, stake1), errors.incorrectState);
  });

  it('one user betting multiple times receives all stake plus total interest', async () => {
    const totalLosingStake = stake0 + stake1 + stake2;
    const totalStake = stake0 + stake1 + stake2 + stake3 + stake4;
    const totalWinningStake = stake3 + stake4;
    await prepareForBetting();

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
    await prepareForBetting();

    await placeBet(user0, NON_OCCURING, stake0);
    await placeBet(user1, OCCURING, stake1);

    await letOutcomeDoesntExistOccur();

    let userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
    userResult = await withdrawAndReturnActualAndExpectedBalance(user1, stake1, 0, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
  });

  it('payout stake plus interest in case of no winner', async () => {
    const totalStake = stake0;
    const totalWinningStake = 0;
    const expectedInterest = new BN(web3.utils.toWei((totalStake / 10).toString(), 'ether'));
    await prepareForBetting();
    await placeBet(user0, NON_OCCURING, stake0);
    await letOutcomeOccur();
    let totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);

    const userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
  });

  it("can't determine winner if oracle has not yet resolved", async () => {
    await prepareForBetting();
    await placeBet(user0, NON_OCCURING, stake0);
    await expectRevert(magicBet.determineWinner(), errors.oracleNotFinalised);
  });

  it('check getTotalInterest', async () => {
    await prepareForBetting();
    await placeBet(user0, NON_OCCURING, stake0);
    await placeBet(user1, OCCURING, stake1);
    await placeBet(user2, OCCURING, stake2);
    // total interest should be zero
    let totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
    await letOutcomeOccur();
    // interest should be 10% of total stake
    let totalStake = stake0 + stake1 + stake2;
    totalInterest = await magicBet.getTotalInterest();
    let expectedInterest = new BN(web3.utils.toWei((totalStake / 10).toString(), 'ether'));
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    // loser withdraws, total interest should be unchanged
    await magicBet.withdraw({from: user0});
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    // one of the winners withdraws, should be drop in interest
    await magicBet.withdraw({from: user1});
    expectedInterest = new BN(web3.utils.toWei(((totalStake / 10) * (stake2 / (stake1 + stake2))).toString(), 'ether'));
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    //final withdrawal, should be no interest left
    await magicBet.withdraw({from: user2});
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
  });

  it('check getTotalInterest but interest increases between withdrawals', async () => {
    await prepareForBetting();
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
    let expectedInterest = new BN(web3.utils.toWei((totalStake / 10).toString(), 'ether'));
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    // loser withdraws, total interest should be unchanged
    await magicBet.withdraw({from: user0}); //1100 - 200 = 900 left
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);
    // interest increases by 10%, total -> 990, interest = 190
    await aToken.generate10PercentInterest(magicBet.address);
    totalInterest = await magicBet.getTotalInterest();
    expectedInterest = new BN(web3.utils.toWei((190).toString(), 'ether'));
    // user1 withdraws, should get 190 * 300/800 interest which leaves 71.25 interest
    await magicBet.withdraw({from: user1});
    totalInterest = await magicBet.getTotalInterest();
    expectedInterest = new BN(web3.utils.toWei((71.25).toString(), 'ether'));
    // increase interest and final user withdraws, should be zero interest left.
    await aToken.generate10PercentInterest(magicBet.address);
    await magicBet.withdraw({from: user2});
    totalInterest = await magicBet.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
  });

  it('check getMaxTotalInterest', async () => {
    await prepareForBetting();
    await placeBet(user0, NON_OCCURING, stake0); //200
    await placeBet(user1, OCCURING, stake1); //300
    await placeBet(user2, OCCURING, stake2); //500
    // increase interest and check that getMax increases with it
    await aToken.generate10PercentInterest(magicBet.address);
    let totalInterest = await magicBet.getTotalInterest();
    let maxInterest = await magicBet.getMaxTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(maxInterest).to.be.bignumber;
    // again
    await aToken.generate10PercentInterest(magicBet.address);
    totalInterest = await magicBet.getTotalInterest();
    maxInterest = await magicBet.getMaxTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(maxInterest).to.be.bignumber;
    // resolve, get final interest amount
    await letOutcomeOccur();
    let actualMaxInterest = await magicBet.getTotalInterest();
    // withdraw, maxInterest should not reduce
    await magicBet.withdraw({from: user1});
    maxInterest = await magicBet.getMaxTotalInterest();
    expect(actualMaxInterest).to.be.bignumber.equal(maxInterest).to.be.bignumber;
  });

  async function prepareForBetting() {
    const marketAddress = await magicBetFactory.marketAddresses.call(0);
    magicBet = await MagicBet.at(marketAddress);
    await time.increase(time.duration.seconds(100));
  }

  async function letOutcomeOccur() {
    await aToken.generate10PercentInterest(magicBet.address);
    await realitio.setResult(OCCURING);
    await magicBet.determineWinner();
    await time.increase(time.duration.seconds(100));
  }

  // this also works for invalid outcome i.e. 2^256-1
  async function letOutcomeDoesntExistOccur() {
    await aToken.generate10PercentInterest(magicBet.address);
    await realitio.setResult(OCCURING + 1);
    await magicBet.determineWinner();
    await time.increase(time.duration.seconds(100));
  }

  async function placeBet(user, outcome, stake) {
    await dai.mint(web3.utils.toWei(stake.toString(), 'ether'), {from: user});
    await magicBet.placeBet(outcome, web3.utils.toWei(stake.toString(), 'ether'), {
      from: user,
    });
  }

  async function withdrawAndReturnActualAndExpectedBalance(
    _user,
    _stakeOnWinning,
    _stakeOnLosing,
    _totalStake,
    _totalWinningStake
  ) {
    await magicBet.withdraw({
      from: _user,
    });
    const actualBalance = await dai.balanceOf(_user);
    let expectedBalance = _stakeOnWinning + _stakeOnLosing;
    const outcome = await magicBet.winningOutcome();
    const invalidOutcome = outcome != OCCURING && outcome != NON_OCCURING;

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
      expectedBalance: web3.utils.toWei(expectedBalance.toString(), 'ether').toString(),
    };
  }
});
