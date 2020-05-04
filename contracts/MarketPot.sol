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

contract MarketPot is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint;

    ////////////////////////////////////
    //////// VARIABLES /////////////////
    ////////////////////////////////////

    //////// Externals ////////
    Dai public dai;
    IaToken public aToken;
    IAaveLendingPool public aaveLendingPool;
    IAaveLendingPoolCore public aaveLendingPoolCore;
    IRealitio public realitio;

    //////// Market Details ////////
    uint public marketOpeningTime; // when the market is opened for bets
    uint public marketLockingTime; // when the market is no longer open for bets
    uint32 public marketResolutionTime; // the time the realitio market is able to be answered, uint32 cos Realitio needs it
    bytes32 public questionId; // the question ID of the question on realitio
    string public eventName;
    mapping (uint => string) public eventOutcomes;
    uint public numberOfOutcomes; 

    //////// Betting variables ////////
    mapping(address => mapping(uint => uint)) public balances;
    mapping(uint => uint) public totalBetPerOutcome;
    uint public totalBet;
    address[] public participants;
    mapping (address => bool) withdrawnBool; //so users can only withdraw once
    uint public winningOutcome = 69; // start with incorrect winning outcome
    uint public totalWithdrawn;
    enum States {WAITING, OPEN, LOCKED, WITHDRAW}
    States public state; // 

    // Testing
    uint public a;

    ////////////////////////////////////
    //////// CONSTRUCTOR ///////////////
    ////////////////////////////////////
    constructor(
        Dai _daiAddress,
        IaToken _aTokenAddress,
        IAaveLendingPool _aaveLpAddress,
        IAaveLendingPoolCore _aaveLpcoreAddress,
        IRealitio _realitioAddress,
        uint _marketOpeningTime,
        uint32 _marketResolutionTime,
        address _arbitrator,
        string memory _eventName,
        uint _numberOfOutcomes,
        address _owner
    ) public {
        if (_owner != msg.sender) {
            transferOwnership(_owner);
        }

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
        eventName = _eventName;
        numberOfOutcomes = _numberOfOutcomes;
        // We need to get the below from an argument eventually
        // ... but I'm getting "Stack too deep, try using fewer variables" error
        eventOutcomes[0] = "Donald Trump";
        eventOutcomes[1] = "Joe Biden";

        // Create the question on Realitio
        uint _templateId = 2;
        // ultimately this needs to be created from the input arguments (i.e. concatenated):
        string memory _question = 'Who will win the 2020 US General Election␟"Donald Trump","Joe Biden"␟news-politics␟en_US';
        // timeout = how long the market can be disputed on realitio after an answer has been submitted, 24 hours
        uint _nonce = 0;
        uint32 _timeout = 86400;
        questionId = _postQuestion(
            _templateId,
            _question,
            _arbitrator,
            _timeout,
            _marketResolutionTime,
            _nonce
        );
    }

    ////////////////////////////////////
    //////// EVENTS ////////////////////
    ////////////////////////////////////
    event ParticipantEntered(address indexed participant);
    event StateChanged(States state);
    event WinnerSelected(address indexed winner);


    ////////////////////////////////////
    ////////// VIEW FUNCTIONS //////////
    ////////////////////////////////////
    function getMarketSize() public view returns (uint) {
        return participants.length;
    }

    function getUserBet(uint _outcome) public view returns (uint) {
        return balances[msg.sender][_outcome];
    }

    /// @dev returns total winnings for a user based on current accumulated interest
    /// @dev ... and assuming the passed _outcome wins. 
    function getWinnings(uint _outcome) public view returns (uint) {
        uint _winnings;
        uint _amountBetOnOutcome = balances[msg.sender][_outcome];
        if (_amountBetOnOutcome > 0) {
            uint _remainingPrincipal = totalBet.sub(totalWithdrawn);
            uint _totalAdaibalances = aToken.balanceOf(address(this)); 
            uint _totalInterest = _totalAdaibalances.sub(_remainingPrincipal);
            _winnings = (_amountBetOnOutcome.mul(_totalInterest)).div(_remainingPrincipal);
        }
        return _winnings;
    }

    // need the interest rate for this
    // function getEstimatedReturn(uint _outcome) returns (uint) {
    //     uint _timeLocked = marketResolutionTime.
    // }

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
    //////// REALIITO FUNCTIONS ////////
    ////////////////////////////////////

    /// @notice posts the question to realit.io
    function _postQuestion(
        uint template_id,
        string memory question,
        address arbitrator,
        uint32 timeout,
        uint32 opening_ts,
        uint nonce
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

    /// @notice gets the winning outcome from realitio
    /// @dev this function call will revert if it has not yet resolved
    function _determineWinner() internal view returns(uint) {
        bytes32 _winningOutcome = realitio.resultFor(questionId);
        return uint(_winningOutcome);
    }

    /// @notice has the question been finalized on realitio?
    function _isQuestionFinalized() internal view returns (bool) {
        return realitio.isFinalized(questionId);
    }

    ////////////////////////////////////
    ////////// DAI FUNCTIONS///////////
    ////////////////////////////////////

    // * internal * 
    /// @notice common function for all outgoing DAI transfers
    function _sendCash(address _to, uint _amount) internal { 
        require(dai.transfer(_to,_amount), "Cash transfer failed"); 
    }

    // * internal * 
    /// @notice common function for all incoming DAI transfers
    function _receiveCash(address _from, uint _amount) internal {  
        require(dai.transferFrom(_from, address(this), _amount), "Cash transfer failed");
    }

    ////////////////////////////////////
    //////// EXTERNAL FUNCTIONS ////////
    ////////////////////////////////////

    function placeBet(uint _outcome, uint _dai)
        external
        checkState(States.OPEN)
        whenNotPaused
    {
        if (balances[msg.sender][_outcome] == 0) participants.push(msg.sender);
        emit ParticipantEntered(msg.sender);
        // increment three variables- balances, totalBet, totalBetPerOutcome
        balances[msg.sender][_outcome] = balances[msg.sender][_outcome].add(_dai);
        totalBet = totalBet.add(_dai);
        totalBetPerOutcome[_outcome] = totalBetPerOutcome[_outcome].add(_dai);
        _receiveCash(msg.sender, _dai);
    }

    function determineWinner() 
        external
        whenNotPaused
    {
        require(_isQuestionFinalized(), "Oracle has not finalised");
        winningOutcome = _determineWinner();
        incrementState();
    }

    function incrementState() 
        public 
        whenNotPaused 
    {
        if(((state == States.WAITING) && (marketOpeningTime > now)) ||  
           ((state == States.OPEN) && (marketLockingTime > now)) || 
           ((state == States.LOCKED) && (winningOutcome != 69)) )
        {
            state = States(uint(state) + 1);
        }
        emit StateChanged(state);
    }

    function withdraw()
        external
        checkState(States.WITHDRAW)
        whenNotPaused
    {
        require(!withdrawnBool[msg.sender], "Already withdrawn");
        withdrawnBool[msg.sender] = true;
        // first, return user's original bet
        _returnBet();
        // get winnings
        uint _winnings = getWinnings(winningOutcome);
        if (_winnings > 0) {
            // effects
            totalWithdrawn = totalWithdrawn.add(_winnings); 
            // interaction
            aToken.redeem(_winnings);
            _sendCash(msg.sender, _winnings);
        }
    }

    ////////////////////////////////////
    //////// INTERNAL FUNCTIONS ////////
    ////////////////////////////////////
    function _returnBet() 
        internal 
    {
        for (uint i = 0; i < numberOfOutcomes; i++) 
        {
            uint _amountBetOnOutcome = balances[msg.sender][i];
            if (_amountBetOnOutcome > 0) {
                // effects
                totalWithdrawn = totalWithdrawn.add(_amountBetOnOutcome);
                // interactions
                aToken.redeem(_amountBetOnOutcome);
                _sendCash(msg.sender, _amountBetOnOutcome);
            }
        }
    }

    ////////////////////////////////////
    ///// BOILERPLATE FUNCTIONS ////////
    ////////////////////////////////////

    function disableContract() public onlyOwner returns (bool) {
        _pause();
    }

    receive() external payable {}

    fallback() external payable {}
}
