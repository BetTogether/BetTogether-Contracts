const BTMarket = artifacts.require("BTMarket.sol");
const BTMarketFactory = artifacts.require("BTMarketFactory.sol");
const DaiMockup = artifacts.require("DaiMockup");
const aTokenMockup = artifacts.require("aTokenMockup");
const RealitioMockup = artifacts.require("RealitioMockup.sol");

// kovan addresses
const aaveCashAddressKovan = "0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD";
const aaveAtokenAddressKovan = "0x58AD4cB396411B691A9AAb6F74545b2C5217FE6a";
const aaveLendingPoolAddressKovan =
  "0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c";
const aaveLendingPoolCoreAddressKovan =
  "0x95D1189Ed88B380E319dF73fF00E479fcc4CFa45";
const realitioAddressKovan = "0x50E35A1ED424aB9C0B8C7095b3d9eC2fb791A168";
const daiAddressKovan = '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD';

// market details DUMMY/TESTING DATA ONLY, NOT FOR MAINNET
const marketOpeningTime = 0;
const marketResolutionTime = 0;
const arbitrator = "0x34A971cA2fd6DA2Ce2969D716dF922F17aAA1dB0";
const eventName = "US 2020 General Election";
const numberOfOutcomes = 2;
const timeout = 10;
const owner = "0xCb4BF048F1Aaf4E0C05b0c77546fE820F299d4Fe";

// Currently deploying BTMarket directly. Ultimately it will deploy BTMarketFactory
module.exports = function (deployer, network) {
  if (network === "develop") {
    deployer.deploy(DaiMockup).then((deployedDai) => {
      return deployer
        .deploy(aTokenMockup, deployedDai.address)
        .then((deployedaToken) => {
          return deployer.deploy(RealitioMockup).then((deployedRealitio) => {
            return deployer.deploy(
              BTMarket,
              deployedDai.address,
              deployedaToken.address,
              deployedaToken.address,
              deployedaToken.address,
              deployedRealitio.address,
              marketOpeningTime,
              marketResolutionTime,
              arbitrator,
              eventName,
              numberOfOutcomes,
              timeout,
              owner,
              true
            );
          });
        });
    });
  } else if (network === "kovan") {
    deployer.deploy(
      BTMarketFactory,
      daiAddressKovan,
      aaveAtokenAddressKovan,
      aaveLendingPoolAddressKovan,
      aaveLendingPoolCoreAddressKovan,
      realitioAddressKovan
    );
  }
};
