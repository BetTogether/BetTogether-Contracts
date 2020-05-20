const {BN, shouldFail, ether, expectEvent, balance, time} = require('@openzeppelin/test-helpers');

const DaiMockup = artifacts.require('DaiMockup');
const aTokenMockup = artifacts.require('aTokenMockup');
const BetTogether = artifacts.require('TestBTMarket');
const BetTogetherFactory = artifacts.require('TestBTMarketFactory');
const RealitioMockup = artifacts.require('RealitioMockup.sol');

const marketOpeningTime = 0;
const marketResolutionTime = 0;
const arbitrator = '0x34A971cA2fd6DA2Ce2969D716dF922F17aAA1dB0';
const question = 'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US';
const numberOfOutcomes = 2;
const eventName = 'Who will win the 2020 US General Election';
const marketStates = Object.freeze({SETUP: 0, WAITING: 1, OPEN: 2, LOCKED: 3, WITHDRAW: 4});

const NON_OCCURING = 0;
const OCCURING = 1;
const stake0 = 200;
const stake1 = 300;
const stake2 = 500;
const stake3 = 100;
const stake4 = 400;
const totalStake = stake0 + stake1 + stake2 + stake3 + stake4;
const totalWinningStake = stake3 + stake4;
const totalInterest = totalStake * 0.1;

contract('BetTogetherTests', (accounts) => {
  user0 = accounts[0];
  user1 = accounts[1];
  user2 = accounts[2];
  user3 = accounts[3];
  user4 = accounts[4];
  user5 = accounts[5];
  user6 = accounts[6];
  user7 = accounts[7];
  user8 = accounts[8];

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
    await betTogetherFactory.createMarket(
      eventName,
      marketOpeningTime,
      marketOpeningTime,
      marketResolutionTime,
      30,
      arbitrator,
      question,
      numberOfOutcomes
    );
  });

  it('betting leads to winners receiving both stake and interest, losers receiving their stake back', async () => {
    marketAddress = await betTogetherFactory.markets.call(0);
    betTogether = await BetTogether.at(marketAddress);
    await betTogether.createTokenContract('Donald Trump', 'MBtrump');
    await betTogether.createTokenContract('Joe Biden', 'MBbiden');
    await betTogether.incrementState();

    await placeBet(user0, NON_OCCURING, stake0);
    await placeBet(user1, NON_OCCURING, stake1);
    await placeBet(user2, NON_OCCURING, stake2);
    await placeBet(user2, OCCURING, stake3);
    await placeBet(user3, OCCURING, stake4);

    await aToken.generate10PercentInterest(betTogether.address);
    await betTogether.incrementState();
    await realitio.setResult(OCCURING);
    await betTogether.determineWinner();

    // check returned deposit + winnings for user2 and user3
    let userResult = await withdrawAndReturnActualAndExpectedBalance(user2, stake3, stake2); // user/staked on winning/staked on losing
    assert.equal(userResult.actualBalance, userResult.expectedBalance);
    userResult = await withdrawAndReturnActualAndExpectedBalance(user3, stake4, 0);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);

    // check returned deposit for losers user0 and user1
    userResult = await withdrawAndReturnActualAndExpectedBalance(user0, 0, stake0);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);
    userResult = await withdrawAndReturnActualAndExpectedBalance(user1, 0, stake1);
    assert.equal(userResult.actualBalance, userResult.expectedBalance);

    // check totalBets and betsWithdrawn
    totalBets = await betTogether.totalBets.call();
    assert.equal(totalBets, web3.utils.toWei(totalStake.toString(), 'ether'));
    betsWithdrawn = await betTogether.betsWithdrawn.call();
    assert.equal(betsWithdrawn, web3.utils.toWei(totalStake.toString(), 'ether'));
  });

  it('check market states transition', async () => {
    marketAddress = await betTogetherFactory.markets.call(0);
    betTogether = await BetTogether.at(marketAddress);
    expect((await betTogether.state()).toNumber()).to.equal(marketStates.SETUP);
    await expect(placeBet(user0, NON_OCCURING, stake0)).to.be.reverted;
    await betTogether.createTokenContract('Donald Trump', 'MBtrump');
    await betTogether.createTokenContract('Joe Biden', 'MBbiden');
    expect((await betTogether.state()).toNumber()).to.equal(marketStates.WAITING);
    await expect(placeBet(user0, NON_OCCURING, stake0)).to.be.reverted;

    await betTogether.incrementState();
    expect((await betTogether.state()).toNumber()).to.equal(marketStates.OPEN);

    await placeBet(user0, NON_OCCURING, stake0);
    await betTogether.incrementState(); // test mode allows to switch to LOCKED instantly
    expect((await betTogether.state()).toNumber()).to.equal(marketStates.LOCKED);
    await expect(placeBet(user0, OCCURING, stake1)).to.be.reverted;
    await expect(betTogether.withdraw({from: user0})).to.be.reverted;

    await realitio.setResult(OCCURING);
    await betTogether.determineWinner();

    expect((await betTogether.state()).toNumber()).to.equal(marketStates.WITHDRAW);
    betTogether.withdraw({from: user0}); // should succeed now
    await expect(placeBet(user0, OCCURING, stake1)).to.be.reverted;
  });

  async function placeBet(user, outcome, stake) {
    await betTogether.placeBet(outcome, web3.utils.toWei(stake.toString(), 'ether'), {
      from: user,
    });
  }

  async function withdrawAndReturnActualAndExpectedBalance(user, stakeOnWinning, stakeOnLosing) {
    await betTogether.withdraw({
      from: user,
    });
    let actualBalance = await dai.balanceOf(user);
    let expectedBalance = stakeOnWinning + stakeOnLosing;

    if (stakeOnWinning > 0) {
      let shareOfInterest = (stakeOnWinning / totalWinningStake) * totalInterest;
      expectedBalance += shareOfInterest;
    }
    return {
      actualBalance: actualBalance,
      expectedBalance: web3.utils.toWei(expectedBalance.toString(), 'ether'),
    };
  }
});
