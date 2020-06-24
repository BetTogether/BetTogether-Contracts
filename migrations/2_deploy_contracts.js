const MBMarket = artifacts.require('MBMarket.sol');
const MBMarketFactory = artifacts.require('MBMarketFactory.sol');
const DaiMockup = artifacts.require('DaiMockup');
const aTokenMockup = artifacts.require('aTokenMockup');
const RealitioMockup = artifacts.require('RealitioMockup.sol');

// KOVAN VARIABLES
const AAVE_CASH_ADDRESS_KOVAN = '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD';
const AAVE_ATOKEN_ADDRESS_KOVAN = '0x58AD4cB396411B691A9AAb6F74545b2C5217FE6a';
const AAVE_LENDING_POOL_ADDRESS_KOVAN = '0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c';
const AAVE_LENDING_POOL_CORE_ADDRESS_KOVAN = '0x95D1189Ed88B380E319dF73fF00E479fcc4CFa45';
const REALITIO_ADDRESS_KOVAN = '0x50E35A1ED424aB9C0B8C7095b3d9eC2fb791A168';
const UNISWAP_ROUTER_ADDRESS_KOVAN = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const DAI_ADDRESS_KOVAN = '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD';

// RINKEBY VARIABLES
const AAVE_CASH_ADDRESS_RINKEBY = '';
const AAVE_ATOKEN_ADDRESS_RINKEBY = '';
const AAVE_LENDING_POOL_ADDRESS_RINKEBY = '';
const AAVE_LENDING_POOL_CORE_ADDRESS_RINKEBY = '';
const REALITIO_ADDRESS_RINKEBY = '0x3D00D77ee771405628a4bA4913175EcC095538da';
const UNISWAP_ROUTER_ADDRESS_RINKEBY = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const DAI_ADDRESS_RINKEBY = '';

// market details
const marketOpeningTime = 0;
const marketResolutionTime = 0;
const arbitrator = '0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D'; // kleros mainnet address.
const numberOfOutcomes = 2;
const owner = '0xCb4BF048F1Aaf4E0C05b0c77546fE820F299d4Fe';
const question = 'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US';
const eventName = 'Who will win the 2020 US General Election';

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
      DAI_ADDRESS_KOVAN,
      AAVE_ATOKEN_ADDRESS_KOVAN,
      AAVE_LENDING_POOL_ADDRESS_KOVAN,
      AAVE_LENDING_POOL_CORE_ADDRESS_KOVAN,
      REALITIO_ADDRESS_KOVAN,
      UNISWAP_ROUTER_ADDRESS_KOVAN
    );
    // market deploy
    // deployer.deploy(
    //   MBMarket,
    //   DAI_ADDRESS_KOVAN,
    //   AAVE_ATOKEN_ADDRESS_KOVAN,
    //   AAVE_LENDING_POOL_ADDRESS_KOVAN,
    //   AAVE_LENDING_POOL_CORE_ADDRESS_KOVAN,
    //   REALITIO_ADDRESS_KOVAN,
    //   eventName,
    //   marketOpeningTime,
    //   marketResolutionTime,
    //   arbitrator,
    //   question,
    //   numberOfOutcomes,
    //   owner,
    //   true
    // );
  } else if (network === 'rinkeby') {
    deployer.deploy(
      MBMarketFactory,
      DAI_ADDRESS_RINKEBY,
      AAVE_ATOKEN_ADDRESS_RINKEBY,
      AAVE_LENDING_POOL_ADDRESS_RINKEBY,
      AAVE_LENDING_POOL_CORE_ADDRESS_RINKEBY,
      REALITIO_ADDRESS_RINKEBY,
      UNISWAP_ROUTER_ADDRESS_RINKEBY
    );
  }
};
