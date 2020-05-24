# MagicBet - Contracts

_Lossless Ethereum Betting_

[![#built_with_Truffle](https://img.shields.io/badge/built%20with-Truffle-blueviolet?style=flat-square)](https://www.trufflesuite.com/)
[![#built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF?style=flat-square)](https://docs.openzeppelin.com/)
![#solc 0.6.7](https://img.shields.io/badge/solc-0.6.7-brown?style=flat-square)

MagicBet is a no loss betting platform, built on the Ethereum ecosystem. It allows users to bet on real life future events and outcomes without risking to lose their stake.

All stakes accrue interest until the event which is bet on happens. The interest payment is then shared among the winners, and all participants (winners and losers) get their stakes back - thus allowing users to save money in a fun manner.

This project contains the Ethereum smart contracts, the client code can be found under the following link.

[Corresponding Client](https://github.com/BetTogether/BetTogether-Client)

## Setup

Given that [NodeJS](https://nodejs.org/) and [npm](https://www.npmjs.com/) are installed, clone the repo and then run `npm install` inside the root directory to install the dependencies.

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

This will deploy the BTMarketFactory contract. You then have to copy the content of the folder `abis/` over to the Client repo into `src/abis/`, and then follow the ReadMe of that repo to run the app locally.
