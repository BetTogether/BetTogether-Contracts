//REMOVE ONCE WE CAN AUTOMATICALLY DEPLOY CONTRACTS

pragma solidity 0.6.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./MarketPot.sol";
import "./interfaces/IAave.sol";
import "./interfaces/IDai.sol";
import "./interfaces/IRealitio.sol";

contract MarketPotFactory is Ownable, Pausable {

    ////////////////////////////////////
    //////// VARIABLES /////////////////
    ////////////////////////////////////
    
    // Externals
    Dai public dai;
    IaToken public aToken;
    IAaveLendingPool public aaveLendingPool;
    IAaveLendingPoolCore public aaveLendingPoolCore;
    IRealitio public realitio;

    mapping(address => bool) mappingOfMarketPots;
    address[] public marketPots;

    event MarketPotCreated(address contractAddress);

    modifier createdByThisFactory(address potAddr) {
        require(
            mappingOfMarketPots[potAddr],
            "Must be created by this factory"
        );
        _;
    }

    constructor(
        Dai _daiAddress,
        IaToken _aTokenAddress,
        IAaveLendingPool _aaveLpAddress,
        IAaveLendingPoolCore _aaveLpcoreAddress,
        IRealitio _realitioAddress
    ) public {
        // Externals
        dai = _daiAddress;
        aToken = _aTokenAddress;
        aaveLendingPool = _aaveLpAddress;
        aaveLendingPoolCore = _aaveLpcoreAddress;
        realitio = _realitioAddress;
    }

    function createMarket(
        uint _marketOpeningTime,
        uint32 _marketResolutionTime,
        address _arbitrator,
        string memory _eventName,
        uint _numberOfOutcomes
    )
        public
        onlyOwner
        whenNotPaused
        returns (MarketPot)
    {
        MarketPot newContract = new MarketPot({
            _daiAddress: dai,
            _aTokenAddress: aToken, 
            _aaveLpAddress: aaveLendingPool, 
            _aaveLpcoreAddress: aaveLendingPoolCore, 
            _realitioAddress: realitio, 
            _marketOpeningTime: _marketOpeningTime,
            _marketResolutionTime: _marketResolutionTime,
            _arbitrator: _arbitrator,
            _eventName: _eventName,
            _numberOfOutcomes: _numberOfOutcomes,
            _owner: msg.sender});

        address newAddress = address(newContract);
        marketPots.push(newAddress);
        mappingOfMarketPots[newAddress] = true;
        emit MarketPotCreated(address(newAddress));
        return newContract;
    }

    function getMarketPots() public view returns (address[] memory) {
        return marketPots;
    }

    function destroy() public onlyOwner whenPaused {
        selfdestruct(msg.sender);
    }

    function disableMarketPot(address payable potAddress)
        public
        onlyOwner
        createdByThisFactory(potAddress)
        returns (bool)
    {
        return MarketPot(potAddress).disableContract();
    }
}
