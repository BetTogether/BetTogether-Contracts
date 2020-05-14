usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@nomiclabs/buidler-truffle5");
require("dotenv").config();
const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const INFURA_KEY = process.env.INFURA_KEY;
const MNEMONIC = process.env.MNEMONIC;

// Go to https://buidler.dev/config/ to learn more
module.exports = {
  solc: {
    version: "0.6.8",
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  paths: {
    artifacts: "./artifactsBuidler",
  },
};
