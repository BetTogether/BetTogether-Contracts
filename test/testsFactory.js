const {
  BN,
  shouldFail,
  ether,
  expectEvent,
  balance,
  time
} = require('@openzeppelin/test-helpers');

const DaiMockup = artifacts.require("DaiMockup");
const aTokenMockup = artifacts.require("aTokenMockup");
const BetTogether = artifacts.require("BTMarket");
const BetTogetherFactory = artifacts.require("BTMarketFactory");
const RealitioMockup = artifacts.require("RealitioMockup.sol");

const marketOpeningTime = 0;
const marketResolutionTime = 0;
const arbitrator = "0x34A971cA2fd6DA2Ce2969D716dF922F17aAA1dB0";
const question = 'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US';
const numberOfOutcomes = 2;
const eventName = 'Who will win the 2020 US General Election';

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
    betTogetherFactory = await BetTogetherFactory.new(dai.address, aToken.address, aToken.address, aToken.address, realitio.address);
    await betTogetherFactory.createMarket(eventName, marketOpeningTime, marketResolutionTime,
      arbitrator, question, numberOfOutcomes);
  });

  it('betting leads to winner receiving stake and interest, loser receives stake back', async () => {
    const NON_OCCURING = 0;
    const OCCURING = 1;
    const stake0 = 200;
    const stake1 = 300;
    const stake2 = 100;
    const stake3 = 400;
    const totalStake = stake0 + stake1 + stake2 + stake3;
    const totalWinningStake = stake2 + stake3;
    const totalInterest = totalStake * 0.1;
    marketAddress = await betTogetherFactory.markets.call(0);
    betTogether = await BetTogether.at(marketAddress);
    await betTogether.createTokenContract('Donald Trump', 'MBtrump');
    await betTogether.createTokenContract('Joe Biden', 'MBbiden');
    await betTogether.incrementState();
    await betTogether.placeBet(NON_OCCURING, web3.utils.toWei(stake0.toString(), 'ether'), {
      from: user0
    });
    await betTogether.placeBet(NON_OCCURING, web3.utils.toWei(stake1.toString(), 'ether'), {
      from: user1
    });
    await betTogether.placeBet(OCCURING, web3.utils.toWei(stake2.toString(), 'ether'), {
      from: user2
    });
    await betTogether.placeBet(OCCURING, web3.utils.toWei(stake3.toString(), 'ether'), {
      from: user3
    });
    await aToken.generate10PercentInterest(betTogether.address);
    await betTogether.incrementState();
    await realitio.setResult(OCCURING);
    await betTogether.determineWinner();
    // check returned deposit + winnings for user2 and user3
    await betTogether.withdraw({
      from: user2
    });
    var daiSentUser2 = await dai.balanceOf(user2);
    var withdrawn2 = stake2 + stake2 / totalWinningStake * totalInterest;
    assert.equal(daiSentUser2, web3.utils.toWei(withdrawn2.toString(), 'ether'));

    await betTogether.withdraw({
      from: user3
    });
    var daiSentUser3 = await dai.balanceOf(user3);
    var withdrawn3 = stake3 + stake3 / totalWinningStake * totalInterest;
    assert.equal(daiSentUser3, web3.utils.toWei(withdrawn3.toString(), 'ether'));

    // check returned deposit for losers user0 and user1
    await betTogether.withdraw({
      from: user0
    });
    var daiSentUser0 = await dai.balanceOf(user0);
    assert.equal(daiSentUser0, web3.utils.toWei(stake0.toString(), 'ether'));

    await betTogether.withdraw({
      from: user1
    });
    var daiSentUser1 = await dai.balanceOf(user1);
    assert.equal(daiSentUser1, web3.utils.toWei(stake1.toString(), 'ether'));

    // check totalBets and betsWithdrawn
    totalBets = await betTogether.totalBets.call();
    assert.equal(totalBets, web3.utils.toWei(totalStake.toString(), 'ether'));
    betsWithdrawn = await betTogether.betsWithdrawn.call();
    assert.equal(betsWithdrawn, web3.utils.toWei(totalStake.toString(), 'ether'));
  });
});