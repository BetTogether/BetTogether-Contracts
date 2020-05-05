require("dotenv").config();
const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider");
// const INFURA_ID = process.env.INFURA_KEY;
// const MNEMONIC = process.env.MNEMONIC;
const INFURA_ID = "d460ac4e71f24d869c8b75119ebe4213";
const MNEMONIC =
  "manual common build dilemma episode air casino time magnet equal curve slice";

module.exports = {
  plugins: ["truffle-security"],
  contracts_build_directory: path.join(__dirname, "client/src/contracts"),
  networks: {
    develop: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    mainnet: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://mainnet.infura.io/v3/${INFURA_ID}`
        );
      },
      network_id: 1,
      gas: 15000000,
    },
    ropsten: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://ropsten.infura.io/v3/${INFURA_ID}`
        );
      },
      network_id: 3,
      gas: 15000000,
    },
    rinkeby: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://rinkeby.infura.io/v3/${INFURA_ID}`
        );
      },
      network_id: 4,
      gas: 15000000,
    },
    goerli: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://goerli.infura.io/v3/${INFURA_ID}`
        );
      },
      network_id: 5,
      gas: 15000000,
    },
    kovan: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://kovan.infura.io/v3/${INFURA_ID}`
        );
      },
      network_id: 42,
      gas: 9990236,
    },
  },
  compilers: {
    solc: {
      version: "0.6.7",
    },
  },
};
