const chai = require('chai');
const {time} = require('@openzeppelin/test-helpers');

chai.use(require('chai-as-promised'));

const {expect} = chai;

const aTokenMockup = artifacts.require('aTokenMockup');
const magicBetMockup = artifacts.require('magicBetMockup');
const MagicBet = artifacts.require('MBMarket');
const MagicBetFactory = artifacts.require('MBMarketFactory');
const DaiMockup = artifacts.require('DaiMockup');
const RealitioMockup = artifacts.require('RealitioMockup.sol');
const UniswapMockup = artifacts.require('UniswapMockup.sol');

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
    const magicBetLib = await MagicBet.new();
    magicBetFactory = await MagicBetFactory.new(
      dai.address,
      aToken.address,
      aToken.address,
      aToken.address,
      realitio.address,
      uniswap.address
    );
    await magicBetFactory.setLibraryAddress(magicBetLib.address);
    await createMarket();
  });

  async function createMarket() {
    const marketOpeningTime = (await time.latest()).toNumber() + 100;
    const marketLockingTime = marketOpeningTime + 100;
    const marketResolutionTime = marketLockingTime + 100;
    await magicBetFactory.createMarket(
      'eventName',
      marketOpeningTime,
      marketLockingTime,
      marketResolutionTime,
      30,
      '0x34A971cA2fd6DA2Ce2969D716dF922F17aAA1dB0',
      'question',
      ['Trump', 'Biden']
    );
    const marketAddress = await magicBetFactory.mostRecentContract();
    magicBet = await MagicBet.at(marketAddress);
  }

  it('check market states transition', async () => {
    const magicBetLibNew = await magicBetMockup.new();
    await magicBetFactory.setLibraryAddress(magicBetLibNew.address);
    await createMarket();

    const mockedContract = await magicBetMockup.at(magicBet.address);
    const newFunctionResult = await mockedContract.newFunction();
    expect(newFunctionResult.toString()).to.be.equal('1337');

    const magicBetLibOld = await MagicBet.new();
    await magicBetFactory.setLibraryAddress(magicBetLibOld.address);
    await createMarket();

    const oldLibContract = await magicBetMockup.at(magicBet.address);
    await expect(oldLibContract.newFunction()).to.be.rejected;

    // old contract still works
    const newFunctionResult2 = await mockedContract.newFunction();
    expect(newFunctionResult2.toString()).to.be.equal('1337');
  });
});
