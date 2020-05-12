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
const RealitioMockup = artifacts.require("RealitioMockup.sol");

const marketOpeningTime = 0;
const marketResolutionTime = 0;
const arbitrator = "0x34A971cA2fd6DA2Ce2969D716dF922F17aAA1dB0";
const numberOfOutcomes = 2;
const owner = "0xCb4BF048F1Aaf4E0C05b0c77546fE820F299d4Fe";
const question = 'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US';


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
    betTogether = await BetTogether.new(dai.address, aToken.address, aToken.address, aToken.address, realitio.address, marketOpeningTime, marketResolutionTime, arbitrator, question, numberOfOutcomes, owner, true);
  });

  it('test', async () => {
    await betTogether.incrementState();
    await betTogether.placeBet(0,web3.utils.toWei('100', 'ether'), {from: user0});
    await betTogether.placeBet(1,web3.utils.toWei('200', 'ether'), {from: user1});
    await aToken.generate10PercentInterest(betTogether.address);
    await betTogether.incrementState();
    await realitio.setResult(1);
    await betTogether.determineWinner();
    await betTogether.withdraw({from: user0});
    var depositReturned = await dai.balanceOf(user0);
    assert.equal(depositReturned,web3.utils.toWei('100', 'ether'));
    // check totalBet and totalWithdrawn
    var totalBet = await betTogether.totalBet.call();
    assert.equal(totalBet,web3.utils.toWei('300', 'ether'))
    var totalWithdrawn = await betTogether.totalWithdrawn.call();
    assert.equal(totalWithdrawn,web3.utils.toWei('100', 'ether'))
    //
    await betTogether.withdraw({from: user1});
    var depositReturned = await dai.balanceOf(user1);
    assert.equal(depositReturned,web3.utils.toWei('230', 'ether'));
  });

});
