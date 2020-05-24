# MagicBet Contracts

_Lossless Ethereum Betting_

[![#built_with_Truffle](https://img.shields.io/badge/built%20with-Truffle-blueviolet?style=flat-square)](https://www.trufflesuite.com/)
[![#built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF?style=flat-square)](https://docs.openzeppelin.com/)
![#solc 0.6.7](https://img.shields.io/badge/solc-0.6.7-brown?style=flat-square)

MagicBet is a no loss betting platform built on Ethereum. All stakes accrue interest until the event happens. The interest payment is then shared among the winners, and all participants get their stakes back.
This project contains the Ethereum smart contracts, the client code can be found under the following link.

[Corresponding Client](https://github.com/BetTogether/BetTogether-Client)

## Setup

Clone the repo and then install dependencies:

```
$ npm install
```

For the environment variables you need to create a `.env` file in the root directory which contains the keys MNEMONIC and INFURA_KEY with your personal data like this:

```
INFURA_KEY=your_key_4_infura
MNEMONIC=the mnemonic phrase for your wallet
```

## Testing

To run the unit tests, enter:

```
$ npx buidler test
```

## Deploy

To deploy to the Kovan test net, run

```
truffle migrate --reset --network kovan
```

This will deploy the BTMarketFactory contract. You then have to copy the file `abis/BTMarketFactory.json` over to the Client repo into the `src/abis` directory, and then follow the ReadMe of that repo to run the app locally.
