//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.8;

import './BTMarket.sol';
import './BTMarketFactory.sol';
import './TestBTMarket.sol';


contract TestBTMarketFactory is BTMarketFactory {
    constructor(
        Dai _daiAddress,
        IaToken _aTokenAddress,
        IAaveLendingPool _aaveLpAddress,
        IAaveLendingPoolCore _aaveLpcoreAddress,
        IRealitio _realitioAddress
    ) public BTMarketFactory(_daiAddress, _aTokenAddress, _aaveLpAddress, _aaveLpcoreAddress, _realitioAddress) {}

    function createMarket(
        string memory _eventName,
        uint256 _marketOpeningTime,
        uint256 _marketLockingTime,
        uint32 _marketResolutionTime,
        uint32 _timeout,
        address _arbitrator,
        string memory _question,
        uint256 _numberOfOutcomes
    )
        public
        override
        /* onlyOwner TODO removed for development */
        whenNotPaused
        returns (BTMarket)
    {
        uint256[3] memory marketTimes = [_marketOpeningTime, _marketLockingTime, _marketResolutionTime];
        BTMarket newContract = new TestBTMarket({
            _daiAddress: dai,
            _aTokenAddress: aToken,
            _aaveLpAddress: aaveLendingPool,
            _aaveLpcoreAddress: aaveLendingPoolCore,
            _realitioAddress: realitio,
            _eventName: _eventName,
            _marketTimes: marketTimes,
            _arbitrator: _arbitrator,
            _question: _question,
            _numberOfOutcomes: _numberOfOutcomes,
            _owner: msg.sender
        });
        address newAddress = address(newContract);
        markets.push(newAddress);
        mappingOfMarkets[newAddress] = true;
        emit MarketCreated(address(newAddress));
        return newContract;
    }
}
