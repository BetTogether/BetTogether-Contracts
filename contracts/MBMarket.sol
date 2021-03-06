//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import '@nomiclabs/buidler/console.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/IAave.sol';
import './interfaces/IDai.sol';
import './interfaces/IRealitio.sol';
import './interfaces/IUniswapV2Router02.sol';
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
    IUniswapV2Router02 public uniswapRouter;

    //////// Market Details ////////
    uint256 public maxInterest = 0; // for the front end
    uint256 public marketOpeningTime; // when the market can opened for bets
    uint256 public marketLockingTime; // when the market is no longer open for bets
    uint256 public marketResolutionTime; // the time the realitio market is able to be answered, uint32 inside Realitio
    bytes32 public questionId; // the question ID of the question on realitio
    string public eventName;
    string[] public outcomeNames;
    Token[] public tokenAddresses;
    uint256 public numberOfOutcomes;

    //////// Betting variables ////////
    // totalBetsPerOutcome and betsWithdrawnPerOutcome keep track of the remaining 'principal'
    mapping(uint256 => uint256) public totalBetsPerOutcome;
    mapping(uint256 => uint256) public betsWithdrawnPerOutcome;
    mapping(uint256 => uint256) public usersPerOutcome;
    mapping(uint256 => uint256[]) private betAmountsArray;
    mapping(uint256 => uint256[]) private timestampsArray;

    uint256 public totalBets; // equivalent to 'max bets' goes up with each new bet but does not go down as winnings are withdrawn
    uint256 public betsWithdrawn; // totalBets less - betsWithdrawn should always be equal to outstanding bets
    uint256 public totalSponsoredMoney; // additional sponsored money that cannot win
    mapping(address => uint256) public sponsoredMoney;
    address[] public participants;

    //////// Market resolution variables ////////
    uint256 public winningOutcome;

    ////////////////////////////////////
    //////// CONSTRUCTOR ///////////////
    ////////////////////////////////////
    function initialize(
        Dai _daiAddress,
        address[3] memory _aaveAddresses,
        IRealitio _realitioAddress,
        IUniswapV2Router02 _uniswapRouter,
        string memory _eventName,
        uint256[4] memory _marketTimes,
        address _arbitrator,
        string memory _realitioQuestion,
        string[] memory _outcomeNamesArray
    ) public {
        require(!isInitialized, 'Contract already initialized.');
        isInitialized = true;

        winningOutcome = UNRESOLVED_OUTCOME_RESULT;

        // externals
        dai = _daiAddress;
        aToken = IaToken(_aaveAddresses[0]);
        aaveLendingPool = IAaveLendingPool(_aaveAddresses[1]);
        realitio = _realitioAddress;
        uniswapRouter = _uniswapRouter;

        // approvals
        dai.approve(_aaveAddresses[2], type(uint256).max);

        // pass arguments to public variables
        eventName = _eventName;
        marketOpeningTime = _marketTimes[0];
        marketLockingTime = _marketTimes[1];
        marketResolutionTime = uint32(_marketTimes[2]);
        numberOfOutcomes = _outcomeNamesArray.length;

        // create the tokens
        for (uint256 i = 0; i < numberOfOutcomes; i++) {
            _createTokenContract(_outcomeNamesArray[i]);
        }

        // Create the question on Realitio
        uint256 _templateId = 2;
        uint256 _nonce = now; // <- should probably change this to zero for mainnet
        questionId = _postQuestion(
            _templateId,
            _realitioQuestion,
            _arbitrator,
            uint32(_marketTimes[3]),
            uint32(marketResolutionTime),
            _nonce
        );
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

    function _createTokenContract(string memory _outcomeName) internal {
        outcomeNames.push(_outcomeName);
        Token tokenContract = new Token({_tokenName: _outcomeName});
        tokenAddresses.push(tokenContract);
    }

    ////////////////////////////////////
    //////// MODIFIERS /////////////////
    ////////////////////////////////////
    modifier checkState(States requiredState) {
        require(getCurrentState() == requiredState, 'function cannot be called at this time');
        _;
    }

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

    function getTokenAddresses() external view returns (Token[] memory) {
        return tokenAddresses;
    }

    function getParticipants() external view returns (address[] memory) {
        return participants;
    }

    function getBetAmountsArray(uint256 _outcome) external view returns (uint256[] memory) {
        return betAmountsArray[_outcome];
    }

    function getTimestampsArray(uint256 _outcome) external view returns (uint256[] memory) {
        return timestampsArray[_outcome];
    }

    function getMarketSize() public view returns (uint256) {
        return participants.length;
    }

    function getMaxTotalInterest() public view returns (uint256) {
        if (maxInterest > 0) {
            return maxInterest;
        } else {
            return getTotalInterest();
        }
    }

    function getTotalInterest() public view returns (uint256) {
        uint256 _remainingBet = totalBets.sub(betsWithdrawn);
        uint256 _totalAdaibalances = aToken.balanceOf(address(this));
        uint256 _totalInterest = _totalAdaibalances.sub(_remainingBet);
        return _totalInterest;
    }

    function getEstimatedETHforDAI(uint256 daiAmount) public view returns (uint256[] memory) {
        address[] memory path = _getDAIforETHpath();
        return uniswapRouter.getAmountsIn(daiAmount, path);
    }

    ////////////////////////////////////
    //////// REALIITO FUNCTIONS ////////
    ////////////////////////////////////

    /// @notice posts the market question onto realit.io
    /// @param template_id always 2
    /// @param question string passed to realitio
    /// @param arbitrator = kleros
    /// @param timeout how long answer can be challenged until finalised
    /// @param opening_ts when the question can first be answered
    /// @param nonce nonce
    /// @return the ID of the question on realitio
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

    /// @notice determines the winning outcome from realitio
    /// @dev this function call will revert if it has not yet resolved
    /// @return the winning outcome of the event
    function _determineWinner() internal view returns (uint256) {
        bytes32 _winningOutcome = realitio.resultFor(questionId);
        return uint256(_winningOutcome);
    }

    /// @notice Function called by determineWinner to see if question has been finalized
    /// @return whether or not the question has been finalized on realitio
    function _isQuestionFinalized() internal view returns (bool) {
        return realitio.isFinalized(questionId);
    }

    ////////////////////////////////////
    /////// EXTERNAL DAI CALLS /////////
    ////////////////////////////////////

    /// @notice common function for all outgoing DAI transfers
    /// @param _to address to send to
    /// @param _amount amount to send
    function _sendCash(address _to, uint256 _amount) internal {
        require(dai.transfer(_to, _amount), 'Cash transfer failed');
    }

    /// @notice common function for all incoming DAI transfers
    /// @param _from address that is receiving cash
    /// @param _amount amount to recieve
    function _receiveCash(
        address _from,
        uint256 _amount,
        uint256 _uniswapDeadline
    ) internal {
        if (msg.value > 0) {
            _swapETHForExactTokenWithUniswap(_amount, _uniswapDeadline);
            return;
        }

        require(dai.transferFrom(_from, address(this), _amount), 'Cash transfer failed');
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

    function placeBet(
        uint256 _outcome,
        uint256 _dai,
        uint256 _uniswapDeadline // set to 0 if paying in DAI
    ) external payable checkState(States.OPEN) whenNotPaused {
        _placeBet(_outcome, _dai);
        _receiveCash(msg.sender, _dai, _uniswapDeadline);
        _sendToAave(_dai);
    }

    function determineWinner() external whenNotPaused {
        require(_isQuestionFinalized(), 'Oracle has not finalised');
        winningOutcome = _determineWinner();
    }

    function withdraw() external checkState(States.WITHDRAW) whenNotPaused nonReentrant {
        if (maxInterest == 0) {
            maxInterest = getTotalInterest();
        }

        if (totalBetsPerOutcome[winningOutcome] > 0) {
            _payoutWinnings();
        } else {
            _payoutWinningsInvalid();
        }

        _burnUsersTokens();
    }

    function sponsorEvent(uint256 sponsorAmount) external {
        dai.transferFrom(msg.sender, address(this), sponsorAmount);
        _sendToAave(sponsorAmount);
        sponsoredMoney[msg.sender] = sponsoredMoney[msg.sender].add(sponsorAmount);
        totalSponsoredMoney = totalSponsoredMoney.add(sponsorAmount);
    }

    function withdrawSponsorMoney(uint256 withdrawAmount) external {
        sponsoredMoney[msg.sender] = sponsoredMoney[msg.sender].sub(
            withdrawAmount,
            'Cannot withdraw more than deposited'
        );
        totalSponsoredMoney = totalSponsoredMoney.sub(withdrawAmount);

        _redeemFromAave(withdrawAmount);
        dai.transfer(msg.sender, withdrawAmount);
    }

    ////////////////////////////////////
    //////// INTERNAL FUNCTIONS ////////
    ////////////////////////////////////

    /// @notice returns winning user's share of interest
    /// @param _totalBetAmount total bet among all outcomes
    /// @param _userBetOutcomeAmount total bet on winning outcome
    /// @return users's share of the interest
    function _calculateWinnings(uint256 _totalBetAmount, uint256 _userBetOutcomeAmount)
        internal
        view
        returns (uint256)
    {
        uint256 winnings = 0;

        if (_totalBetAmount > 0) {
            uint256 _totalInterest = getTotalInterest();
            winnings = (_totalInterest.mul(_userBetOutcomeAmount)).div(_totalBetAmount);
        }

        return winnings;
    }

    function _getUserBetsAllOutcomes() internal view returns (uint256) {
        // get total bet across all outcomes
        uint256 _userBetsAllOutcomes;
        for (uint256 i = 0; i < numberOfOutcomes; i++) {
            Token _token = Token(tokenAddresses[i]);
            uint256 _userBetThisOutcome = _token.balanceOf(msg.sender);
            _userBetsAllOutcomes = _userBetsAllOutcomes.add(_userBetThisOutcome);
        }
        return _userBetsAllOutcomes;
    }

    function _getWinningsGivenOutcome(uint256 _outcome) internal view returns (uint256) {
        Token _token = Token(tokenAddresses[_outcome]);
        uint256 _userBetOnOutcome = _token.balanceOf(msg.sender);
        uint256 _totalRemainingBetsOnOutcome = totalBetsPerOutcome[_outcome].sub(betsWithdrawnPerOutcome[_outcome]);
        return _calculateWinnings(_totalRemainingBetsOnOutcome, _userBetOnOutcome);
    }

    function _payoutWinnings() internal {
        uint256 _winnings = _getWinningsGivenOutcome(winningOutcome);
        uint256 _daiToSend = _winnings.add(_getUserBetsAllOutcomes());

        // externals
        if (_daiToSend > 0) {
            _redeemFromAave(_daiToSend);
            _sendCash(msg.sender, _daiToSend);
        }
    }

    function _payoutWinningsInvalid() internal {
        uint256 _winningsInvalid = _calculateWinnings(totalBets.sub(betsWithdrawn), _getUserBetsAllOutcomes());
        uint256 _daiToSend = _winningsInvalid.add(_getUserBetsAllOutcomes());

        // externals
        if (_daiToSend > 0) {
            _redeemFromAave(_daiToSend);
            _sendCash(msg.sender, _daiToSend);
        }
    }

    function _placeBet(uint256 _outcome, uint256 _dai) internal {
        Token _token = tokenAddresses[_outcome];

        betAmountsArray[_outcome].push(_dai);
        timestampsArray[_outcome].push(now);

        if (_token.balanceOf(msg.sender) == 0) {
            participants.push(msg.sender);
            usersPerOutcome[_outcome] = usersPerOutcome[_outcome].add(1);
        }

        _token.mint(msg.sender, _dai);
        totalBets = totalBets.add(_dai);
        totalBetsPerOutcome[_outcome] = totalBetsPerOutcome[_outcome].add(_dai);

        emit ParticipantEntered(msg.sender);
    }

    function _burnUsersTokens() internal {
        for (uint256 i = 0; i < numberOfOutcomes; i++) {
            Token _token = Token(tokenAddresses[i]);
            uint256 _userBetThisOutcome = _token.balanceOf(msg.sender);
            if (_userBetThisOutcome > 0) {
                betsWithdrawnPerOutcome[i] = betsWithdrawnPerOutcome[i].add(_userBetThisOutcome);
                betsWithdrawn = betsWithdrawn.add(_userBetThisOutcome);
                _token.burn(msg.sender, _userBetThisOutcome);
            }
        }
    }

    function _swapETHForExactTokenWithUniswap(uint256 daiAmount, uint256 deadline) private {
        address[] memory path = _getDAIforETHpath();

        uniswapRouter.swapETHForExactTokens{value: msg.value}(daiAmount, path, address(this), deadline);

        (bool success, ) = msg.sender.call{value: address(this).balance}(''); // refund leftover ETH
        require(success, 'Refund of ETH failed');
    }

    function _getDAIforETHpath() private view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = address(dai);

        return path;
    }

    ////////////////////////////////////
    ///// BOILERPLATE FUNCTIONS ////////
    ////////////////////////////////////
    function disableContract() public onlyOwner whenNotPaused returns (bool) {
        // onlyOwner ensures only factory can pause
        _pause();
    }

    function enableContract() public onlyOwner whenPaused returns (bool) {
        // onlyOwner ensures only factory can unpause
        _unpause();
    }

    receive() external payable {}

    fallback() external payable {}
}
