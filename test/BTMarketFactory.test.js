'use strict';

const {BN, shouldFail, ether, expectEvent, balance, time} = require('@openzeppelin/test-helpers');

const aTokenMockup = artifacts.require('aTokenMockup');
const BetTogether = artifacts.require('MBMarket');
const BetTogetherFactory = artifacts.require('MBMarketFactory');
const DaiMockup = artifacts.require('DaiMockup');
const RealitioMockup = artifacts.require('RealitioMockup.sol');

const NON_OCCURING = 0;
const OCCURING = 1;

const stake0 = 200;
const stake1 = 300;
const stake2 = 500;
const stake3 = 100;
const stake4 = 400;

let aToken;
let dai;
let betTogether;
let betTogetherFactory;
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

contract('BetTogetherTests', (accounts) => {
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
    betTogetherFactory = await BetTogetherFactory.new(
      dai.address,
      aToken.address,
      aToken.address,
      aToken.address,
      realitio.address
    );
    const arbitrator = '0x34A971cA2fd6DA2Ce2969D716dF922F17aAA1dB0';
    const eventName = 'Who will win the 2020 US General Election';
    const marketOpeningTime = 0;
    const marketResolutionTime = 0;
    const question = 'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US';
    const outcomeNamesArray = ['Trump', 'Biden'];
    await betTogetherFactory.createMarket(
      eventName,
      marketOpeningTime,
      marketOpeningTime,
      marketResolutionTime,
      30,
      arbitrator,
      question,
      outcomeNamesArray
    );
  });

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
    const totalBets = await betTogether.totalBets.call();
    assert.equal(totalBets, web3.utils.toWei(totalStake.toString(), 'ether'));
    const betsWithdrawn = await betTogether.betsWithdrawn.call();
    assert.equal(betsWithdrawn, web3.utils.toWei(totalStake.toString(), 'ether'));
  });

  it('check market states transition', async () => {
    const marketAddress = await betTogetherFactory.marketAddresses.call(0);
    betTogether = await BetTogether.at(marketAddress);
    const marketStates = Object.freeze({SETUP: 0, WAITING: 1, OPEN: 2, LOCKED: 3, WITHDRAW: 4});
    expect((await betTogether.state()).toNumber()).to.equal(marketStates.WAITING);
    await expect(placeBet(user0, NON_OCCURING, stake0)).to.be.reverted;

    await betTogether.incrementState();
    expect((await betTogether.state()).toNumber()).to.equal(marketStates.OPEN);
    // incrementing state again here would change it to LOCKED as 'marketLockingTime' is set to 0 in the test

    await placeBet(user0, NON_OCCURING, stake0);
    await betTogether.incrementState(); // test mode allows to switch to LOCKED instantly
    expect((await betTogether.state()).toNumber()).to.equal(marketStates.LOCKED);
    // incrementing state again doesn't change it
    await betTogether.incrementState();
    expect((await betTogether.state()).toNumber()).to.equal(marketStates.LOCKED);
    await expect(placeBet(user0, OCCURING, stake1)).to.be.reverted; // too late
    await expect(betTogether.withdraw({from: user0})).to.be.reverted; // too early

    await realitio.setResult(OCCURING);
    await betTogether.determineWinner();

    expect((await betTogether.state()).toNumber()).to.equal(marketStates.WITHDRAW);
    await betTogether.withdraw({from: user0}); // should succeed now
    await expect(placeBet(user0, OCCURING, stake1)).to.be.reverted;
    await expect(betTogether.withdraw({from: user0})).to.be.reverted; // not a second time!
    // incrementing state again doesn't change it
    await betTogether.incrementState();
    expect((await betTogether.state()).toNumber()).to.equal(marketStates.WITHDRAW);
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

  it('payout all stakes plus interest in case of an invalid outcome', async () => {
    const totalStake = stake0 + stake1;
    const totalWinningStake = stake1;
    await prepareForBetting();

    await placeBet(user0, NON_OCCURING, stake0);
    await placeBet(user1, OCCURING, stake1);

    await letInvalidOutcomeOccur();

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
    let totalInterest = await betTogether.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(expectedInterest);

    const userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0, totalStake, totalWinningStake);
    expect(userResult.actualBalance).to.be.bignumber.equal(userResult.expectedBalance);
    totalInterest = await betTogether.getTotalInterest();
    expect(totalInterest).to.be.bignumber.equal(new BN(0));
  });

  async function prepareForBetting() {
    const marketAddress = await betTogetherFactory.marketAddresses.call(0);
    betTogether = await BetTogether.at(marketAddress);
    await betTogether.incrementState();
  }

  async function letOutcomeOccur() {
    await aToken.generate10PercentInterest(betTogether.address);
    await betTogether.incrementState();
    await realitio.setResult(OCCURING);
    await betTogether.determineWinner();
  }

  async function letInvalidOutcomeOccur() {
    await aToken.generate10PercentInterest(betTogether.address);
    await betTogether.incrementState();
    await realitio.setResult(OCCURING + 1);
    await betTogether.determineWinner();
  }

  async function placeBet(user, outcome, stake) {
    await dai.mint(web3.utils.toWei(stake.toString(), 'ether'), {from: user});
    await betTogether.placeBet(outcome, web3.utils.toWei(stake.toString(), 'ether'), {
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
    await betTogether.withdraw({
      from: _user,
    });
    const actualBalance = await dai.balanceOf(_user);
    let expectedBalance = _stakeOnWinning + _stakeOnLosing;
    const outcome = await betTogether.winningOutcome();
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
      actualBalance: actualBalance,
      expectedBalance: web3.utils.toWei(expectedBalance.toString(), 'ether'),
    };
  }
});
