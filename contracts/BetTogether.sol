pragma solidity >=0.4.21 <0.7.0;

import "@nomiclabs/buidler/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IAave.sol";
import "./interfaces/IDai.sol";
import "./interfaces/IRealitio.sol";

contract BetTogether is ERC20  {

    using SafeMath for uint;

    ////////////////////////////////////
    //////// Variables ///////////////////
    ////////////////////////////////////

    // Testing
    uint public a;

    //Externals
    Dai dai;
    IaToken aToken;
    IAaveLendingPool aaveLendingPool;
    IAaveLendingPoolCore aaveLendingPoolCore;

    ////////////////////////////////////
    //////// Constructor ///////////////////
    ////////////////////////////////////

    constructor(Dai _daiAddress, IaToken _aTokenAddress, IAaveLendingPool _aaveLpAddress, IAaveLendingPoolCore _aaveLpcoreAddress ) ERC20("BetTogether", "BT") public { 
        dai = _daiAddress;
        aToken = _aTokenAddress; 
        aaveLendingPool = _aaveLpAddress; 
        aaveLendingPoolCore = _aaveLpcoreAddress; 
    }

    function testFunction(uint newA) public {
        a = newA;
    }
}
