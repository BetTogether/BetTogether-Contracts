//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';

import './MBMarket.sol';
import './lib/CloneFactory.sol';
import './interfaces/IAave.sol';
import './interfaces/IDai.sol';
import './interfaces/IRealitio.sol';
import './interfaces/IUniswapV2Router02.sol';

/// @title The MagicBet factory
/// @notice This contract allows for generating new market instances
contract MBMarketFactory is CloneFactory, Ownable, Pausable {
    address public libraryAddress;

    Dai public dai;
    IaToken public aToken;
    IAaveLendingPool public aaveLendingPool;
    IAaveLendingPoolCore public aaveLendingPoolCore;
    IRealitio public realitio;
    IUniswapV2Router02 public uniswapRouter;

    mapping(address => bool) public mappingOfMarkets;
    address payable[] public marketAddresses;
    address public mostRecentContract;

    event MarketCreated(address contractAddress);

    constructor(
        Dai _daiAddress,
        IaToken _aTokenAddress,
        IAaveLendingPool _aaveLpAddress,
        IAaveLendingPoolCore _aaveLpcoreAddress,
        IRealitio _realitioAddress,
        IUniswapV2Router02 _uniswapRouter
    ) public {
        dai = _daiAddress;
        aToken = _aTokenAddress;
        aaveLendingPool = _aaveLpAddress;
        aaveLendingPoolCore = _aaveLpcoreAddress;
        realitio = _realitioAddress;
        uniswapRouter = _uniswapRouter;
    }

    /// @notice This function sets the library for fut
    function setLibraryAddress(address _libraryAddress) public onlyOwner {
        libraryAddress = _libraryAddress;
    }

    /// @notice This contract is the framework of each new market
    /// @dev Currently, only owners can generate the markets
    /// @param _eventName The event name
    /// @param _marketOpeningTime When the market opens
    /// @param _marketLockingTime When the market locks
    /// @param _marketResolutionTime When the market is set to resolve
    /// @param _timeout The timeout period
    /// @param _arbitrator The arbitrator address
    /// @param _realitioQuestion The question, formatted to suit how realitio required
    /// @param _outcomeNamesArray The outcomes of this event
    function createMarket(
        string memory _eventName,
        uint256 _marketOpeningTime,
        uint256 _marketLockingTime,
        uint32 _marketResolutionTime,
        uint32 _timeout,
        address _arbitrator,
        string memory _realitioQuestion,
        string[] memory _outcomeNamesArray
    ) public virtual onlyOwner whenNotPaused returns (MBMarket) {
        address payable newAddress = payable(createClone(libraryAddress));

        marketAddresses.push(newAddress);
        mappingOfMarkets[newAddress] = true;
        mostRecentContract = newAddress;
        emit MarketCreated(address(newAddress));

        _initLatestMarket(
            _eventName,
            _marketOpeningTime,
            _marketLockingTime,
            _marketResolutionTime,
            _timeout,
            _arbitrator,
            _realitioQuestion,
            _outcomeNamesArray
        );

        return MBMarket(newAddress);
    }

    function getMarkets() public view returns (address payable[] memory) {
        return marketAddresses;
    }

    function disableMarket(address payable marketAddress) public onlyOwner returns (bool) {
        return MBMarket(marketAddress).disableContract();
    }

    function enableMarket(address payable marketAddress) public onlyOwner returns (bool) {
        return MBMarket(marketAddress).enableContract();
    }

    function _initLatestMarket(
        string memory _eventName,
        uint256 _marketOpeningTime,
        uint256 _marketLockingTime,
        uint32 _marketResolutionTime,
        uint32 _timeout,
        address _arbitrator,
        string memory _realitioQuestion,
        string[] memory _outcomeNamesArray
    ) private {
        MBMarket(marketAddresses[marketAddresses.length - 1]).initialize({
            _daiAddress: dai,
            _aaveAddresses: [address(aToken), address(aaveLendingPool), address(aaveLendingPoolCore)],
            _realitioAddress: realitio,
            _uniswapRouter: uniswapRouter,
            _eventName: _eventName,
            _marketTimes: [_marketOpeningTime, _marketLockingTime, _marketResolutionTime, _timeout],
            _arbitrator: _arbitrator,
            _realitioQuestion: _realitioQuestion,
            _outcomeNamesArray: _outcomeNamesArray
        });
    }
}
