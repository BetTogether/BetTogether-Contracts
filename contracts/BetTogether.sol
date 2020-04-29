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
    //////// VARIABLES /////////////////
    ////////////////////////////////////

    // Testing
    uint public a;

    // Externals
    Dai public dai;
    IaToken public aToken;
    IAaveLendingPool public aaveLendingPool;
    IAaveLendingPoolCore public aaveLendingPoolCore;
    Realitio public realitio;

    // Market
    uint public marketOpeningTime; // when the market is opened for bets
    uint public marketLockingTime; // when the market is no longer open for bets
    uint32 public marketResolutionTime; // the time the realitio market is able to be answered, uint32 cos Realitio needs it
    bytes32 public questionId; // the question ID of the question on realitio

    // 

    ////////////////////////////////////
    //////// CONSTRUCTOR ///////////////
    ////////////////////////////////////

    constructor(Dai _daiAddress, IaToken _aTokenAddress, IAaveLendingPool _aaveLpAddress, IAaveLendingPoolCore _aaveLpcoreAddress, Realitio _realitioAddress, uint _marketOpeningTime, uint32 _marketResolutionTime) ERC20("BetTogether", "BT") public { 
        // Externals
        dai = _daiAddress;
        aToken = _aTokenAddress; 
        aaveLendingPool = _aaveLpAddress; 
        aaveLendingPoolCore = _aaveLpcoreAddress; 
        realitio = _realitioAddress;

        // Pass arguments to public variables
        marketOpeningTime = _marketOpeningTime;
        marketLockingTime = _marketOpeningTime.add(604800); // one week
        marketResolutionTime = _marketResolutionTime;

        // Create the question on Realitio
        uint256 template_id = 2;
        string memory question = 'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US';
        address arbitrator = 0xA6EAd513D05347138184324392d8ceb24C116118; // placeholder, to change
        uint32 timeout = 86400; // how long the market can be disputed on realitio after an answer has been submitted, 24 hours
        uint32 opening_ts = _marketResolutionTime;
        uint256 nonce = 0;
        questionId = _postQuestion(template_id, question, arbitrator, timeout, opening_ts, nonce);
    }

    ////////////////////////////////////
    //////// REALIITO FUNCTIONS ////////
    ////////////////////////////////////

    /// @notice posts the question to realit.io
    function _postQuestion(uint256 template_id, string memory question, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce) internal returns (bytes32) {
        return realitio.askQuestion(template_id, question, arbitrator, timeout, opening_ts, nonce);
    }

    ////////////////////////////////////
    //////// OTHER FUNCTIONS ///////////
    ////////////////////////////////////

    function testFunction(uint newA) public {
        a = newA;
    }

    function placeBet(uint _outcome, uint _bets) public {

    }


}
