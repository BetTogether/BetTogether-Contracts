//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.8;

import '@nomiclabs/buidler/console.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/IAave.sol';
import './interfaces/IDai.sol';
import './interfaces/IRealitio.sol';
import './Token.sol';


contract BTMarket is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;

    ////////////////////////////////////
    //////// VARIABLES /////////////////
    ////////////////////////////////////

    //////// Externals ////////
    Dai public dai;
    IaToken public aToken;
    IAaveLendingPool public aaveLendingPool;
    IRealitio public realitio;

    //////// Setup ////////
    uint256 public tokenContractsCreated;

    //////// Market Details ////////
    uint256 public marketOpeningTime; // when the market is opened for bets
    uint256 public marketLockingTime; // when the market is no longer open for bets
    uint32 public marketResolutionTime; // the time the realitio market is able to be answered, uint32 cos Realitio needs it
    bytes32 public questionId; // the question ID of the question on realitio
    string public eventName;
    string[] public outcomeNames;
    Token[] public tokens;
    uint256 public numberOfOutcomes;
    enum States {SETUP, WAITING, OPEN, LOCKED, WITHDRAW}
    States public state;

    //////// Betting variables ////////
    mapping(uint256 => uint256[]) public betTimestamps;
    mapping(uint256 => uint256) public totalBetsPerOutcome;
    mapping(address => uint256) public totalBetsPerUser;
    mapping(uint256 => uint256) public betsWithdrawnPerOutcome;
    mapping(uint256 => uint256) public usersPerOutcome;
    uint256 public totalBets;
    uint256 public betsWithdrawn;
    address[] public participants;

    //////// Market resolution variables ////////
    mapping(address => bool) public withdrawnBool; //so participants can only withdraw once
    uint256 public winningOutcome = 69; // start with incorrect winning outcome
    bool public questionResolvedInvalid = true; // default to true

    ////////////////////////////////////
    //////// CONSTRUCTOR ///////////////
    ////////////////////////////////////
    constructor(
        Dai _daiAddress,
        IaToken _aTokenAddress,
        IAaveLendingPool _aaveLpAddress,
        IAaveLendingPoolCore _aaveLpcoreAddress,
        IRealitio _realitioAddress,
        string memory _eventName,
        uint256[3] memory _marketTimes,
        uint32 _timeout, // how long realitio waits for a dispute before confirming an answer
        address _arbitrator,
        string memory _question,
        uint256 _numberOfOutcomes,
        address _owner
    ) public {
        if (_owner != msg.sender) {
            transferOwnership(_owner);
        }
        // Externals
        dai = _daiAddress;
        aToken = _aTokenAddress;
        aaveLendingPool = _aaveLpAddress;
        realitio = _realitioAddress;

        // Approvals
        dai.approve(address(_aaveLpcoreAddress), 2**255);

        // Pass arguments to public variables
        eventName = _eventName;
        marketOpeningTime = _marketTimes[0];
        marketResolutionTime = uint32(_marketTimes[1]);
        marketLockingTime = _marketTimes[2];
        numberOfOutcomes = _numberOfOutcomes;

        //Initialise timestamps with contract creation time
        for (uint256 i = 0; i < _numberOfOutcomes; i++) {
            betTimestamps[i].push(now);
        }

        // Create the question on Realitio
        uint256 _templateId = 2;
        uint256 _nonce = now; // <- should probably change this to zero for mainnet
        questionId = _postQuestion(_templateId, _question, _arbitrator, _timeout, marketResolutionTime, _nonce);
    }

    ////////////////////////////////////
    //////// EVENTS ////////////////////
    ////////////////////////////////////
    event ParticipantEntered(address indexed participant);
    event ParticipantWithdrawn(address indexed participant);
    event StateChanged(States state);
    event WinnerSelected(address indexed winner);

    ////////////////////////////////////
    //////// INITIAL SETUP /////////////
    ////////////////////////////////////
    // you cannot pass an array of strings as an argument
    // string manipulation is also difficult, so it is not easy to parse the relevant
    // ... info from the _question string. So, manually set this info
    // probably redundant, the front end can store this, just adding in case

    function setEventName(string calldata _eventName) external onlyOwner {
        eventName = _eventName;
    }

    function createTokenContract(string calldata _outcomeName, string calldata _tokenName)
        external
        onlyOwner
        checkState(States.SETUP)
    {
        outcomeNames.push(_outcomeName);
        Token tokenContract = new Token({_tokenName: _tokenName});
        tokens.push(tokenContract);
        tokenContractsCreated = tokenContractsCreated.add(1);
        if (tokenContractsCreated == numberOfOutcomes) {
            state = States(uint256(state) + 1);
        }
    }

    ////////////////////////////////////
    //////// MODIFIERS /////////////////
    ////////////////////////////////////
    modifier checkState(States currentState) {
        require(state == currentState, 'function cannot be called at this time');
        _;
    }

    ////////////////////////////////////
    ////////// VIEW FUNCTIONS //////////
    ////////////////////////////////////
    function getMarketSize() public view returns (uint256) {
        return participants.length;
    }

    function getParticipantsBet(uint256 _outcome) public view returns (uint256) {
        Token _token = Token(tokens[_outcome]);
        return _token.balanceOf(msg.sender);
    }

    function getTotalInterest() public view returns (uint256) {
        uint256 _remainingBet = totalBets.sub(betsWithdrawn);
        uint256 _totalAdaibalances = aToken.balanceOf(address(this));
        uint256 _totalInterest = _totalAdaibalances.sub(_remainingBet);
        return _totalInterest;
    }

    /// @dev Returns total winnings for a participant based on current accumulated interest
    /// @dev ... and assuming the passed _outcome wins.
    function getWinnings(uint256 _outcome) public view returns (uint256) {
        Token _token = Token(tokens[_outcome]);
        uint256 _winnings;
        uint256 _userBetOnWinningOutcome = _token.balanceOf(msg.sender);
        if (_userBetOnWinningOutcome > 0) {
            uint256 _totalInterest = getTotalInterest();
            uint256 _totalRemainingBetsOnWinningOutcome = totalBetsPerOutcome[winningOutcome].sub(
                betsWithdrawnPerOutcome[winningOutcome]
            );
            if (_totalRemainingBetsOnWinningOutcome > 0) {
                _winnings = (_totalInterest.mul(_userBetOnWinningOutcome)).div(_totalRemainingBetsOnWinningOutcome);
            }
        }
        return _winnings;
    }

    /// @dev if invalid outcome, simply pay out interest in proportion to bets across all tokens
    /// @dev i.e. as if all the outcomes 'won'
    function getWinningsInvalid() public view returns (uint256) {
        uint256 _winningsInvalid;
        if (totalBetsPerUser[msg.sender] > 0) {
            uint256 _totalInterest = getTotalInterest();
            uint256 _totalRemainingBets = totalBets.sub(betsWithdrawn);
            if (_totalRemainingBets > 0) {
                _winningsInvalid = (_totalInterest.mul(totalBetsPerUser[msg.sender])).div(_totalRemainingBets);
            }
        }
        return _winningsInvalid;
    }

    // need the interest rate for this
    // function getEstimatedReturn(uint _outcome) returns (uint) {
    //     uint _timeLocked = marketResolutionTime.
    // }

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
        return realitio.askQuestion(template_id, question, arbitrator, timeout, opening_ts, nonce);
    }

    /// @notice gets the winning outcome from realitio
    /// @dev this function call will revert if it has not yet resolved
    function _determineWinner() internal view returns (uint256) {
        bytes32 _winningOutcome = realitio.resultFor(questionId);
        return uint256(_winningOutcome);
    }

    /// @notice has the question been finalized on realitio?
    function _isQuestionFinalized() internal view returns (bool) {
        return realitio.isFinalized(questionId);
    }

    ////////////////////////////////////
    /////// EXTERNAL DAI CALLS /////////
    ////////////////////////////////////

    /// @notice common function for all outgoing DAI transfers
    function _sendCash(address _to, uint256 _amount) internal {
        require(dai.transfer(_to, _amount), 'Cash transfer failed');
    }

    /// @notice common function for all incoming DAI transfers
    function _receiveCash(address _from, uint256 _amount) internal {
        require(dai.transferFrom(_from, address(this), _amount), 'Cash transfer failed');
    }

    /// @notice mints Dai, will only work on a testnet
    function _mintCash(uint256 _amount) internal {
        dai.mint(_amount);
    }

    ////////////////////////////////////
    /////// EXTERNAL AAVE CALLS ////////
    ////////////////////////////////////

    /// @notice swap Dai for aDai
    function _sendToAave(uint256 _dai) internal {
        aaveLendingPool.deposit(address(dai), _dai, 0);
    }

    /// @notice swap aDai for Dai
    function _redeemFromAave(uint256 _dai) internal {
        aToken.redeem(_dai);
    }

    ////////////////////////////////////
    //////// EXTERNAL FUNCTIONS ////////
    ////////////////////////////////////

    function placeBet(uint256 _outcome, uint256 _dai) external virtual checkState(States.OPEN) whenNotPaused {
        _placeBet(_outcome, _dai);
        _receiveCash(msg.sender, _dai);
        _sendToAave(_dai);
    }

    function determineWinner() external whenNotPaused {
        require(_isQuestionFinalized(), 'Oracle has not finalised');
        winningOutcome = _determineWinner();
        if (winningOutcome != ((2**256) - 1)) {
            questionResolvedInvalid = false;
        }
        incrementState();
    }

    // keep this public as it's called by determineWinner
    // not onlyOwner, can be called by anyone, this is fine
    function incrementState() public whenNotPaused {
        if (
            ((state == States.WAITING) && (marketOpeningTime < now)) ||
            ((state == States.OPEN) && (marketLockingTime < now)) ||
            ((state == States.LOCKED) && (winningOutcome != 69))
        ) {
            state = States(uint256(state) + 1);
            emit StateChanged(state);
        }
    }

    function withdraw() external checkState(States.WITHDRAW) whenNotPaused nonReentrant {
        require(!withdrawnBool[msg.sender], 'Already withdrawn');
        withdrawnBool[msg.sender] = true;
        if (!questionResolvedInvalid) {
            _payoutWinnings();
        } else {
            _payoutWinningsInvalid();
        }
        _burnUsersTokens();
    }

    ////////////////////////////////////
    //////// INTERNAL FUNCTIONS ////////
    ////////////////////////////////////
    function _payoutWinnings() internal {
        uint256 _winnings = getWinnings(winningOutcome);
        uint256 _daiToSend = _winnings.add(totalBetsPerUser[msg.sender]);
        // externals
        if (_daiToSend > 0) {
            _redeemFromAave(_daiToSend);
            _sendCash(msg.sender, _daiToSend);
        }
    }

    function _payoutWinningsInvalid() internal {
        uint256 _winningsInvalid = getWinningsInvalid();
        uint256 _daiToSend = _winningsInvalid.add(totalBetsPerUser[msg.sender]);
        // externals
        if (_daiToSend > 0) {
            _redeemFromAave(_daiToSend);
            _sendCash(msg.sender, _daiToSend);
        }
    }

    function _placeBet(uint256 _outcome, uint256 _dai) internal {
        betTimestamps[_outcome].push(now);
        Token _token = Token(tokens[_outcome]);
        if (_token.balanceOf(msg.sender) == 0) {
            participants.push(msg.sender);
            usersPerOutcome[_outcome] = usersPerOutcome[_outcome].add(1);
        }
        emit ParticipantEntered(msg.sender);
        _token.mint(msg.sender, _dai);
        totalBets = totalBets.add(_dai);
        totalBetsPerOutcome[_outcome] = totalBetsPerOutcome[_outcome].add(_dai);
        totalBetsPerUser[msg.sender] = totalBetsPerUser[msg.sender].add(_dai);
    }

    function _burnUsersTokens() internal {
        uint256 _userBetsAllOutcomes;
        for (uint256 i = 0; i < numberOfOutcomes; i++) {
            Token _token = Token(tokens[i]);
            uint256 _userBetThisOutcome = _token.balanceOf(msg.sender);
            if (_userBetThisOutcome > 0) {
                _userBetsAllOutcomes = _userBetsAllOutcomes.add(_userBetThisOutcome);
                betsWithdrawnPerOutcome[i] = betsWithdrawnPerOutcome[i].add(_userBetThisOutcome);
                _token.burn(msg.sender, _userBetThisOutcome);
            }
        }
        assert(_userBetsAllOutcomes == totalBetsPerUser[msg.sender]);
        betsWithdrawn = betsWithdrawn.add(_userBetsAllOutcomes);
    }

    ////////////////////////////////////
    ///// BOILERPLATE FUNCTIONS ////////
    ////////////////////////////////////
    function disableContract() public onlyOwner whenNotPaused returns (bool) {
        _pause();
    }

    function enableContract() public onlyOwner whenPaused returns (bool) {
        _unpause();
    }

    receive() external payable {}

    fallback() external payable {}
}
