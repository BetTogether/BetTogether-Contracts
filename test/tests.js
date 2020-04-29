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
const BetTogether = artifacts.require("BetTogether");

contract('BetTogetherTests', (accounts) => {

  user = accounts[0];
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
    betTogether = await BetTogether.new(dai.address, aToken.address, aToken.address, aToken.address);
  });

  it('setA', async () => {
    var a = await betTogether.a.call();
    assert.equal(a,0);
    await betTogether.testFunction(3);
    var a = await betTogether.a.call();
    assert.equal(a,3);
  });

});
