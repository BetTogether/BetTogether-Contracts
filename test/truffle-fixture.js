const MBMarketFactory = artifacts.require('MBMarketFactory');

// kovan addresses
const daiAddressKovan = '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD';
const aaveAtokenAddressKovan = '0x58AD4cB396411B691A9AAb6F74545b2C5217FE6a';
const aaveLendingPoolAddressKovan = '0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c';
const aaveLendingPoolCoreAddressKovan = '0x95D1189Ed88B380E319dF73fF00E479fcc4CFa45';
const realitioAddressKovan = '0x50E35A1ED424aB9C0B8C7095b3d9eC2fb791A168';
// const uniswapRouterKovan = '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a';
const uniswapRouterKovan = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

module.exports = async () => {
  const factory = await MBMarketFactory.new(
    daiAddressKovan,
    aaveAtokenAddressKovan,
    aaveLendingPoolAddressKovan,
    aaveLendingPoolCoreAddressKovan,
    realitioAddressKovan,
    uniswapRouterKovan
  );
  MBMarketFactory.setAsDeployed(factory);
};
