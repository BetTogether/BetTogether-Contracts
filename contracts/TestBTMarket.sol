//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.8;

import './interfaces/IAave.sol';
import './interfaces/IDai.sol';
import './BTMarket.sol';
import './Token.sol';


contract TestBTMarket is BTMarket {
    constructor(
        Dai _daiAddress,
        IaToken _aTokenAddress,
        IAaveLendingPool _aaveLpAddress,
        IAaveLendingPoolCore _aaveLpcoreAddress,
        IRealitio _realitioAddress,
        string memory _eventName,
        uint256[3] memory _marketTimes,
        address _arbitrator,
        string memory _question,
        uint256 _numberOfOutcomes,
        address _owner
    )
        public
        BTMarket(
            _daiAddress,
            _aTokenAddress,
            _aaveLpAddress,
            _aaveLpcoreAddress,
            _realitioAddress,
            _eventName,
            _marketTimes,
            30,
            _arbitrator,
            _question,
            _numberOfOutcomes,
            _owner
        )
    {}

    function placeBet(uint256 _outcome, uint256 _dai) external override checkState(States.OPEN) whenNotPaused {
        _placeBet(_outcome, _dai);
        _mintCash(_dai);
        _sendToAave(_dai);
    }
}
