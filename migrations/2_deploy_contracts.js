const BetTogether = artifacts.require("BetTogether.sol");
const DaiMockup = artifacts.require("DaiMockup");
const aTokenMockup = artifacts.require("aTokenMockup");
const RealitioMockup = artifacts.require("RealitioMockup.sol");

let marketOpeningTime = 0;
let marketResolutionTime = 0;

module.exports = function (deployer, network) {
  if (network === "develop") {
    deployer.deploy(DaiMockup).then((deployedDai) => {
      return deployer
        .deploy(aTokenMockup, deployedDai.address)
        .then((deployedaToken) => {
          return deployer.deploy(RealitioMockup).then((deployedRealitio) => {
            return deployer.deploy(
              BetTogether,
              deployedDai.address,
              deployedaToken.address,
              deployedaToken.address,
              deployedaToken.address,
              deployedRealitio.address,
              marketOpeningTime,
              marketResolutionTime
            );
          });
        });
    });
  }
};
