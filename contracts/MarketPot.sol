pragma solidity 0.6.6;

import "@nomiclabs/buidler/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAave.sol";
import "./interfaces/IDai.sol";
import "./interfaces/IRealitio.sol";


contract MarketPot is ERC20, Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;

    ////////////////////////////////////
    //////// VARIABLES /////////////////
    ////////////////////////////////////
    uint256 public creationTime;
    uint256 public marketPotBalance;
    address[] public participants;
    mapping(address => uint256) public participantBalance;
    enum States {OPEN, EARNING, CLOSED}
    States public state;

    // Testing
    uint256 public a;

    // Externals
    Dai public dai;
    IaToken public aToken;
    IAaveLendingPool public aaveLendingPool;
    IAaveLendingPoolCore public aaveLendingPoolCore;
    Realitio public realitio;

    // Market
    uint256 public marketOpeningTime; // when the market is opened for bets
    uint256 public marketLockingTime; // when the market is no longer open for bets
    uint32 public marketResolutionTime; // the time the realitio market is able to be answered, uint32 cos Realitio needs it
    bytes32 public questionId; // the question ID of the question on realitio

    ////////////////////////////////////
    //////// MODIFIERS /////////////////
    ////////////////////////////////////
    modifier checkState(States currentState) {
        require(
            state == currentState,
            "function cannot be called at this time"
        );
        _;
    }

    ////////////////////////////////////
    //////// EVENTS ////////////////////
    ////////////////////////////////////
    event ParticipantEntered(address indexed participant);
    event StateChanged(States state);
    event WinnerSelected(address indexed winner);

    ////////////////////////////////////
    //////// CONSTRUCTOR ///////////////
    ////////////////////////////////////
    constructor(
        Dai _daiAddress,
        IaToken _aTokenAddress,
        IAaveLendingPool _aaveLpAddress,
        IAaveLendingPoolCore _aaveLpcoreAddress,
        Realitio _realitioAddress,
        uint256 _marketOpeningTime,
        uint32 _marketResolutionTime,
        address _owner
    ) public ERC20("BetTogether", "BT") {
        if (_owner != msg.sender) {
            transferOwnership(_owner);
        }
        state = States.OPEN;
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


            string memory question
         = 'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US';
        address arbitrator = 0xA6EAd513D05347138184324392d8ceb24C116118; // placeholder, to change
        uint32 timeout = 86400; // how long the market can be disputed on realitio after an answer has been submitted, 24 hours
        uint32 opening_ts = _marketResolutionTime;
        uint256 nonce = 0;
        questionId = _postQuestion(
            template_id,
            question,
            arbitrator,
            timeout,
            opening_ts,
            nonce
        );
    }

    ////////////////////////////////////
    //////// REALIITO FUNCTIONS ////////
    ////////////////////////////////////

    /// @notice posts the question to realit.io
    function _postQuestion(
        uint256 template_id,
        string memory question,
        address arbitrator,
        uint32 timeout,
        uint32 opening_ts,
        uint256 nonce
    ) internal returns (bytes32) {
        return
            realitio.askQuestion(
                template_id,
                question,
                arbitrator,
                timeout,
                opening_ts,
                nonce
            );
    }

    ////////////////////////////////////
    //////// OTHER FUNCTIONS ///////////
    ////////////////////////////////////

    function testFunction(uint256 newA) public {
        a = newA;
    }

    function placeBet(uint256 daiAmount)
        public
        checkState(States.OPEN)
        whenNotPaused
    {
        if (participantBalance[msg.sender] == 0) participants.push(msg.sender);
        emit ParticipantEntered(msg.sender);
        participantBalance[msg.sender] = participantBalance[msg.sender].add(
            daiAmount
        );
    }

    function incrementState() private whenNotPaused onlyOwner {
        require(uint256(state) < 2, "state cannot be incremented");
        state = States(uint256(state) + 1);
        emit StateChanged(state);
    }

    function getMarketSize() public view returns (uint256) {
        return participants.length;
    }

    function disableContract() public onlyOwner returns (bool) {
        _pause();
    }

    receive() external payable {}

    fallback() external payable {}
}
