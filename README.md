<h1 align="center">
  BetTogether - Contracts
</h1>
<h2 align="center">Loseless Ethereum Betting</h2>

<br/>

[![#built_with_Truffle](https://img.shields.io/badge/built%20with-Truffle-blueviolet?style=flat-square)](https://www.trufflesuite.com/)
[![#built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF?style=flat-square)](https://docs.openzeppelin.com/)
![#solc 0.6.6](https://img.shields.io/badge/solc-0.6.6-brown?style=flat-square)

## [Corresponding Client](https://github.com/BetTogether/BetTogether-Client)

## Installation

### Environment Variables

Inside the root directory, create a `.env` file, and add the keys MNEMONIC and INFURA_KEY.

## Usage

To deploy, run `truffle migrate --reset --network kovan` this will deploy the BTMarketFactory contract. You can then copy the BTMarketFactory.json file over to the Client repo in the src/abis directory, then follow the readme of that repo to test the app.

## Issues

## License
