pragma solidity 0.6.8;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import './BTMarket.sol';
import './interfaces/IAave.sol';
import './interfaces/IDai.sol';
import './interfaces/IRealitio.sol';


contract BTMarketFactory is Ownable, Pausable {
    Dai public dai;
    IaToken public aToken;
    IAaveLendingPool public aaveLendingPool;
    IAaveLendingPoolCore public aaveLendingPoolCore;
    IRealitio public realitio;
    mapping(address => bool) public mappingOfMarkets;
    address[] public markets;

    event MarketCreated(address contractAddress);

    modifier createdByThisFactory(address marketAddress) {
        require(mappingOfMarkets[marketAddress], "Must've been created by the corresponding factory");
        _;
    }

    constructor(
        Dai _daiAddress,
        IaToken _aTokenAddress,
        IAaveLendingPool _aaveLpAddress,
        IAaveLendingPoolCore _aaveLpcoreAddress,
        IRealitio _realitioAddress
    ) public {
        dai = _daiAddress;
        aToken = _aTokenAddress;
        aaveLendingPool = _aaveLpAddress;
        aaveLendingPoolCore = _aaveLpcoreAddress;
        realitio = _realitioAddress;
    }

    function createMarket(
        string memory _eventName,
        uint256 _marketOpeningTime,
        uint32 _marketResolutionTime,
        address _arbitrator,
        string memory _question,
        uint256 _numberOfOutcomes
    )
        public
        /* onlyOwner TODO removed for development */
        whenNotPaused
        returns (BTMarket)
    {
        BTMarket newContract = new BTMarket({
            _daiAddress: dai,
            _aTokenAddress: aToken,
            _aaveLpAddress: aaveLendingPool,
            _aaveLpcoreAddress: aaveLendingPoolCore,
            _realitioAddress: realitio,
            _eventName: _eventName,
            _marketOpeningTime: _marketOpeningTime,
            _marketResolutionTime: _marketResolutionTime,
            _arbitrator: _arbitrator,
            _question: _question,
            _numberOfOutcomes: _numberOfOutcomes,
            _owner: msg.sender,
            _testMode: true
        });
        address newAddress = address(newContract);
        markets.push(newAddress);
        mappingOfMarkets[newAddress] = true;
        emit MarketCreated(address(newAddress));
        return newContract;
    }

    function getMarkets() public view returns (address[] memory) {
        return markets;
    }

    function destroy() public onlyOwner whenPaused {
        selfdestruct(msg.sender);
    }

    function disableMarket(address payable marketAddress)
        public
        onlyOwner
        createdByThisFactory(marketAddress)
        returns (bool)
    {
        return BTMarket(marketAddress).disableContract();
    }
}
