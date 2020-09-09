//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '@nomiclabs/buidler/console.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/IAave.sol';
import './interfaces/IDai.sol';
import './interfaces/IRealitio.sol';
import './Token.sol';

/// @title The MagicBet market instance
/// @notice This contract is the framework of each new market
contract MBMarket is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;

    enum States {WAITING, OPEN, LOCKED, WITHDRAW}

    ////////////////////////////////////
    //////// VARIABLES /////////////////
    ////////////////////////////////////

    uint256 public constant UNRESOLVED_OUTCOME_RESULT = type(uint256).max;
    uint256 public constant ORACLE_TIMEOUT_TIME = 4 weeks;
    bool private isInitialized = false;

    //////// Externals ////////
    Dai public dai;
    IaToken public aToken;
    IAaveLendingPool public aaveLendingPool;
    IRealitio public realitio;

    //////// Market Details ////////
    uint256 public totalInterest = 0; // for the front end
    uint256 public marketOpeningTime; // when the market can opened for bets
    uint256 public marketLockingTime; // when the market is no longer open for bets
    uint256 public marketResolutionTime; // the time the realitio market is able to be answered, uint32 inside Realitio
    bytes32 public questionId; // the question ID of the question on realitio
    string public eventName;
    string[] public outcomeNames;
    Token[] public tokenAddresses;
    uint256 public numberOfOutcomes;

    //////// Betting variables ////////
    mapping(address => mapping(uint256 => uint256)) public userBetAmount;
    mapping(address => mapping(uint256 => uint256)) public userFlowBetAmount;
    mapping(uint256 => uint256) public totalBetsPerOutcome;

    uint256 public totalBets; // equivalent to 'max bets' goes up with each new bet but does not go down as winnings are withdrawn
    uint256 public totalFlowBets; // equivalent to 'max bets' goes up with each new bet but does not go down as winnings are withdrawn
    uint256 public betsWithdrawn; // totalBets less - betsWithdrawn should always be equal to outstanding bets
    uint256 public totalSponsoredMoney; // additional sponsored money that cannot win
    mapping(address => uint256) public sponsoredMoney;

    //////// Market resolution variables ////////
    uint256 public winningOutcome;

    modifier checkState(States requiredState) {
        require(getCurrentState() == requiredState, 'function cannot be called at this time');
        _;
    }

    function initialize(
        Dai _daiAddress,
        address[3] memory _aaveAddresses,
        IRealitio _realitioAddress,
        string memory _eventName,
        uint256[4] memory _marketTimes,
        address _arbitrator,
        string memory _realitioQuestion,
        string[] memory _outcomeNamesArray
    ) public {
        require(!isInitialized, 'Contract already initialized.');
        isInitialized = true;

        winningOutcome = UNRESOLVED_OUTCOME_RESULT;

        outcomeNames = _outcomeNamesArray;

        // externals
        dai = _daiAddress;
        aToken = IaToken(_aaveAddresses[0]);
        aaveLendingPool = IAaveLendingPool(_aaveAddresses[1]);
        realitio = _realitioAddress;

        // approvals
        dai.approve(_aaveAddresses[2], type(uint256).max);

        // pass arguments to public variables
        eventName = _eventName;
        marketOpeningTime = _marketTimes[0];
        marketLockingTime = _marketTimes[1];
        marketResolutionTime = uint32(_marketTimes[2]);
        numberOfOutcomes = _outcomeNamesArray.length;

        // Create the question on Realitio
        uint256 _templateId = 2;
        uint256 _nonce = now; // <- should probably change this to zero for mainnet
        questionId = realitio.askQuestion(
            _templateId,
            _realitioQuestion,
            _arbitrator,
            uint32(_marketTimes[3]),
            uint32(marketResolutionTime),
            _nonce
        );
    }

    event PlacedBet(address indexed participant, uint256 outcome, uint256 daiAmount);

    ////////////////////////////////////
    ////////// VIEW FUNCTIONS //////////
    ////////////////////////////////////
    function getCurrentState() public view returns (States) {
        if (now < marketOpeningTime) {
            return States.WAITING;
        }

        if (now >= marketOpeningTime && now < marketLockingTime) {
            return States.OPEN;
        }

        if (winningOutcome == UNRESOLVED_OUTCOME_RESULT && now < (marketResolutionTime.add(ORACLE_TIMEOUT_TIME))) {
            return States.LOCKED;
        }

        return States.WITHDRAW;
    }

    function getOutcomeNames() external view returns (string[] memory) {
        return outcomeNames;
    }

    ////////////////////////////////////
    //////// EXTERNAL FUNCTIONS ////////
    ////////////////////////////////////

    function depositToAave() external checkState(States.LOCKED) nonReentrant {
        totalBets = dai.balanceOf(address(this));
        aaveLendingPool.deposit(address(dai), totalBets, 0);
    }

    function placeBetWithExistingFlow(uint256 _outcome, uint256 _daiAmount)
        external
        checkState(States.OPEN)
        whenNotPaused
        nonReentrant
    {
        userFlowBetAmount[msg.sender][_outcome] += _daiAmount; // cannot overflow
        totalFlowBets += _daiAmount; // cannot overflow
        userBetAmount[msg.sender][_outcome] += _daiAmount; // cannot overflow
        totalBetsPerOutcome[_outcome] += _daiAmount; // cannot overflow

        emit PlacedBet(msg.sender, _outcome, _daiAmount);
    }

    function placeBet(
        uint256 _outcome,
        uint256 _daiAmount,
        bool _isFlowBet
    ) external payable checkState(States.OPEN) whenNotPaused nonReentrant {
        require(dai.transferFrom(msg.sender, address(this), _daiAmount), 'Cash transfer failed');

        if (_isFlowBet) {
            userFlowBetAmount[msg.sender][_outcome] += _daiAmount; // cannot overflow
            totalFlowBets += _daiAmount; // cannot overflow
        }

        userBetAmount[msg.sender][_outcome] += _daiAmount; // cannot overflow
        totalBetsPerOutcome[_outcome] += _daiAmount; // cannot overflow

        emit PlacedBet(msg.sender, _outcome, _daiAmount);
    }

    function determineWinner() external whenNotPaused nonReentrant {
        require(realitio.isFinalized(questionId), 'Oracle has not finalised');

        winningOutcome = uint256(realitio.resultFor(questionId));
        uint256 totalATokens = aToken.balanceOf(address(this));
        uint256 redeemAmount = totalATokens.sub(totalFlowBets);

        aToken.redeem(redeemAmount);
        totalInterest = totalATokens.sub(totalBets);
    }

    function withdraw() external checkState(States.WITHDRAW) whenNotPaused nonReentrant {
        uint256 userBetOnWinningOutcome = userBetAmount[msg.sender][winningOutcome];

        uint256 winnings = userBetOnWinningOutcome > 0
            ? (totalInterest.mul(userBetOnWinningOutcome)).div(totalBetsPerOutcome[userBetOnWinningOutcome])
            : 0;

        uint256 _daiToSend = winnings.add(_getUserBetsAllOutcomes());

        if (_daiToSend > 0) {
            require(dai.transfer(msg.sender, _daiToSend), 'Cash transfer failed');
        }
    }

    function disableContract() public onlyOwner whenNotPaused returns (bool) {
        _pause();
    }

    function enableContract() public onlyOwner whenPaused returns (bool) {
        _unpause();
    }

    function sponsorEvent(uint256 sponsorAmount) external {
        dai.transferFrom(msg.sender, address(this), sponsorAmount);
        sponsoredMoney[msg.sender] = sponsoredMoney[msg.sender].add(sponsorAmount);
        totalSponsoredMoney = totalSponsoredMoney.add(sponsorAmount);
    }

    function withdrawSponsorMoney(uint256 withdrawAmount) external {
        sponsoredMoney[msg.sender] = sponsoredMoney[msg.sender].sub(
            withdrawAmount,
            'Cannot withdraw more than deposited'
        );
        totalSponsoredMoney = totalSponsoredMoney.sub(withdrawAmount);
        dai.transfer(msg.sender, withdrawAmount);
    }

    // get total bet across all outcomes
    function _getUserBetsAllOutcomes() internal view returns (uint256) {
        uint256 _userBetsAllOutcomes;

        for (uint256 i = 0; i < numberOfOutcomes; i++) {
            _userBetsAllOutcomes += userBetAmount[msg.sender][i]; // cannot overflow
            _userBetsAllOutcomes -= userFlowBetAmount[msg.sender][i]; // cannot underflow
        }
        return _userBetsAllOutcomes;
    }
}
