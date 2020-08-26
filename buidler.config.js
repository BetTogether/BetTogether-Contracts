usePlugin('@nomiclabs/buidler-waffle');
usePlugin('@nomiclabs/buidler-truffle5');

module.exports = {
  networks: {
    buidlerevm: {
      gas: 9500000,
      allowUnlimitedContractSize: true,
    },
  },
  solc: {
    version: '0.6.12',
    optimizer: {
      enabled: true, // enable for now, might cause inconsistent stacktrace lines
      runs: 200,
    },
  },
  paths: {
    artifacts: './abis(Buidler)',
  },
};
