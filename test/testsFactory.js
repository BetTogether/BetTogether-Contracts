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
    marketAddress = await betTogetherFactory.markets.call(0);
    betTogether = await BetTogether.at(marketAddress);
    await betTogether.createTokenContract('Donald Trump','MBtrump');
    await betTogether.createTokenContract('Joe Biden','MBbiden');
    await betTogether.incrementState();
    await betTogether.placeBet(0, web3.utils.toWei('200', 'ether'), {from: user0});
    await betTogether.placeBet(0, web3.utils.toWei('300', 'ether'), {from: user1});
    await betTogether.placeBet(1, web3.utils.toWei('100', 'ether'), {from: user2});
    await betTogether.placeBet(1, web3.utils.toWei('400', 'ether'), {from: user3});
    await aToken.generate10PercentInterest(betTogether.address);
    await betTogether.incrementState();
    await realitio.setResult(1);
    await betTogether.determineWinner();
    // check returned deposit + winngs for user2 and user3
    await betTogether.withdraw({from: user2});
    var daiSentUser = await dai.balanceOf(user2);
    assert.equal(daiSentUser, web3.utils.toWei('120', 'ether'));
    await betTogether.withdraw({from: user3});
    var daiSentUser = await dai.balanceOf(user3);
    assert.equal(daiSentUser, web3.utils.toWei('480', 'ether'));
    // check totalBets and betsWithdrawn
    var totalBets = await betTogether.totalBets.call();
    assert.equal(totalBets, web3.utils.toWei('1000', 'ether'))
    betsWithdrawn = await betTogether.betsWithdrawn.call();
    assert.equal(betsWithdrawn, web3.utils.toWei('500', 'ether'));
    // check returned deposit for losers user0 and user1
    await betTogether.withdraw({from: user0});
    var daiSentUser = await dai.balanceOf(user0);
    assert.equal(daiSentUser, web3.utils.toWei('200', 'ether'));
    await betTogether.withdraw({from: user1});
    var daiSentUser = await dai.balanceOf(user1);
    assert.equal(daiSentUser, web3.utils.toWei('300', 'ether'));
    // check totalBets and betsWithdrawn
    var totalBets = await betTogether.totalBets.call();
    assert.equal(totalBets, web3.utils.toWei('1000', 'ether'))
    var betsWithdrawn = await betTogether.betsWithdrawn.call();
    assert.equal(betsWithdrawn, web3.utils.toWei('1000', 'ether'));

  });
});