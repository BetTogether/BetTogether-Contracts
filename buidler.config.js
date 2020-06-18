usePlugin('@nomiclabs/buidler-waffle');
usePlugin('@nomiclabs/buidler-truffle5');
require('dotenv').config();
const path = require('path');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const INFURA_KEY = process.env.INFURA_KEY;
const MNEMONIC = process.env.MNEMONIC;

// Go to https://buidler.dev/config/ to learn more
module.exports = {
  networks: {
    buidlerevm: {
      gas: 9500000,
      allowUnlimitedContractSize: true,
    },
  },
  solc: {
    version: '0.6.7',
    optimizer: {
      enabled: false, // for correct stack trace lines
      runs: 200,
    },
  },
  paths: {
    artifacts: './abis(Buidler)',
  },
};
