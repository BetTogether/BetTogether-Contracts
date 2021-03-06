const MBMarket = artifacts.require('MBMarket.sol');
const MBMarketFactory = artifacts.require('MBMarketFactory.sol');
const DaiMockup = artifacts.require('DaiMockup');
const aTokenMockup = artifacts.require('aTokenMockup');
const RealitioMockup = artifacts.require('RealitioMockup.sol');

// kovan addresses
const aaveCashAddressKovan = '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD';
const aaveAtokenAddressKovan = '0x58AD4cB396411B691A9AAb6F74545b2C5217FE6a';
const aaveLendingPoolAddressKovan = '0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c';
const aaveLendingPoolCoreAddressKovan = '0x95D1189Ed88B380E319dF73fF00E479fcc4CFa45';
const realitioAddressKovan = '0x50E35A1ED424aB9C0B8C7095b3d9eC2fb791A168';
// const uniswapRouterKovan = '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a';
const uniswapRouterKovan = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const daiAddressKovan = '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD';

// market details DUMMY/TESTING DATA ONLY, NOT FOR MAINNET
const marketOpeningTime = 0;
const marketResolutionTime = 0;
const arbitrator = '0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D'; // kleros mainnet address.
const numberOfOutcomes = 2;
const owner = '0xCb4BF048F1Aaf4E0C05b0c77546fE820F299d4Fe';
const question = 'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US';
const eventName = 'Who will win the 2020 US General Election';

// Currently deploying MBMarket directly. Ultimately it will deploy MBMarketFactory
module.exports = function (deployer, network) {
  if (network === 'develop') {
    deployer.deploy(DaiMockup).then((deployedDai) => {
      return deployer.deploy(aTokenMockup, deployedDai.address).then((deployedaToken) => {
        return deployer.deploy(RealitioMockup).then((deployedRealitio) => {
          return deployer.deploy(
            MBMarket,
            deployedDai.address,
            deployedaToken.address,
            deployedaToken.address,
            deployedaToken.address,
            deployedRealitio.address,
            marketOpeningTime,
            marketResolutionTime,
            arbitrator,
            question,
            numberOfOutcomes,
            owner,
            true
          );
        });
      });
    });
  } else if (network === 'kovan') {
    // factory deploy
    deployer.deploy(
      MBMarketFactory,
      daiAddressKovan,
      aaveAtokenAddressKovan,
      aaveLendingPoolAddressKovan,
      aaveLendingPoolCoreAddressKovan,
      realitioAddressKovan,
      uniswapRouterKovan
    );
    var market;
    deployer
      .then(function () {
        return MBMarket.new();
      })
      .then(function (instance) {
        market = instance;
        return MBMarketFactory.deployed();
      })
      .then(function (instance) {
        return instance.setLibraryAddress(market.address);
      });
  }
};
