//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import '@nomiclabs/buidler/console.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract Token is ERC20, Ownable {
    using SafeMath for uint256;

    constructor(string memory _tokenName) public ERC20(_tokenName, 'MB') {}

    function mint(address _account, uint256 _amount) external onlyOwner {
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external onlyOwner {
        _burn(_account, _amount);
    }

    ////////////////////////////////////
    ///// BOILERPLATE FUNCTIONS ////////
    ////////////////////////////////////

    receive() external payable {}

    fallback() external payable {}
}
