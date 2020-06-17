//SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.21 <0.7.0;


// this is only for ganache testing. Public chain deployments will use the existing Realitio contracts.

contract UniswapMockup {
    function swapETHForExactTokens(
        uint256 daiAmount,
        address[] calldata path,
        address receiver,
        uint256 deadline
    ) external payable returns (bytes32) {
        // TODO if tested
    }
}
