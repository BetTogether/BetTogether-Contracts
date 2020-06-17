<h1 align="center">
  <span role="img" aria-label="tophat">
    🎩
  </span>
  MagicBet - Contracts
</h1>
<h2 align="center">Loseless Ethereum Betting</h2>

<p align="center">
    <a href="https://www.trufflesuite.com/">
    <img src="https://img.shields.io/badge/built%20with-Truffle-blueviolet?style=flat-square" alt="Truffle" />
    </a>
    <a href="https://docs.openzeppelin.com/">
    <img src="https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF?style=flat-square" alt="OpenZeppelin" />
    </a>
        <a href="https://solidity.readthedocs.io/en/v0.6.7/index.html">
    <img src="https://img.shields.io/badge/solc-0.6.7-brown?style=flat-square" alt="Solidity" />
    </a>
</p>

<br/>

MagicBet is a no loss betting platform, built on Ethereum. It allows users to make bets on future events and outcomes without the need to risk their initial stake.

All stakes accrue interest until the event which is bet on happens. The interest payment is then shared among the winners, and all participants (winners and losers) get their stakes back - thus allowing users to save money in a fun manner.

Users are minted ERC20 tokens equalling the Dai bet, which must be burnt when receiving their stake back (and winnings, if any).

This project contains the Ethereum smart contracts, the client code can be found under the following link.

[Corresponding Client](https://github.com/BetTogether/BetTogether-Client)

## Setup

Given that [NodeJS](https://nodejs.org/) and [npm](https://www.npmjs.com/) are installed, clone the repo and then run `npm install` inside the root directory to install the dependencies.

For the environment variables you need to create a `.env` file in the root directory which contains the keys `MNEMONIC` and `INFURA_KEY` with your personal data like this:

```env
INFURA_KEY=your_key_4_infura
MNEMONIC=the mnemonic phrase for your wallet
```

## Testing

To run the unit tests, enter:

```bash
npx buidler test
```

## Deploy

To deploy to the Kovan test net, run

```bash
truffle migrate --reset --network kovan
```

This will deploy the MBMarketFactory contract. Copy the contents of the folder `abis/` over to the Client repo into `src/abis/`. In addition, take a note of the address of the deployed MBMarketFactory.sol, and update the relevant variable in `src/utils/addresses.ts` (line 6 for kovan), also in the Client repo. Then follow the ReadMe of that repo to run the app locally.

## Behind the scenes

Magic Bet uses a factory contract, which itself deploys the markets, and any corresponding ERC20s. The above will deploy the factory contract only, the market contracts are deployed by the front end.

All Dai that is sent to the contract is sent to [Aave](https://aave.com/), whereby it begins to accrue interest. Interest and principal is withdrawn from Aave when users withdraw - the contract never holds funds for more than a single block.

The contract has full [Uniswap V2](https://uniswap.org/) integration, allowing users to pay in Eth instead of Dai, should they wish.

The contract uses [realitio](https://realit.io/) as an Oracle. For continued disputes, the decentralised court [Kleros](https://kleros.io) has been set as an arbitrator. The Magic Bet team have zero ability to set the outcome. For details on how the oracle works, check out this [Medium article](https://bit.ly/2zj5lhM)
