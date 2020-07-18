//SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.21 <0.7.0;
pragma experimental ABIEncoderV2;

// this is only for ganache testing

import '../MBMarket.sol';

contract magicBetMockup is MBMarket {
    function newFunction() external pure returns (uint256) {
        return 1337;
    }
}
