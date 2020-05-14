pragma solidity 0.6.7;

import "@nomiclabs/buidler/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract Token is ERC20, Ownable {
  using SafeMath for uint256;

  constructor (string memory _tokenName) ERC20( _tokenName, "MB") public {}

  ////////////////////////////////////
  ///// BOILERPLATE FUNCTIONS ////////
  ////////////////////////////////////

  receive() external payable {}

  fallback() external payable {}
}
