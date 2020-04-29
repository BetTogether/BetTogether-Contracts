var BetTogether = artifacts.require("./BetTogether.sol");
const DaiMockup = artifacts.require("DaiMockup");
const aTokenMockup = artifacts.require("aTokenMockup");

module.exports = function(deployer, network) {
  if (network === "develop") {
    deployer.deploy(DaiMockup).then((deployedDai) => {
      return deployer.deploy(aTokenMockup, deployedDai.address).then((deployedaToken) => {
        return deployer.deploy(BetTogether, deployedDai.address, deployedaToken.address, deployedaToken.address, deployedaToken.address);
       });
     });
  }
};
