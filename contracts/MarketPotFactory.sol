//REMOVE ONCE WE CAN AUTOMATICALLY DEPLOY CONTRACTS

pragma solidity 0.6.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "./MarketPot.sol";


contract MarketPotFactory is Ownable, Pausable {
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

    function createMarketPot()
        public
        payable
        whenNotPaused
        returns (MarketPot)
    {
        MarketPot newContract = new MarketPot({_owner: msg.sender});

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
