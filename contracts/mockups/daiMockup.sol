pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

// this is only for ganache testing. 

contract DaiMockup

{

    using SafeMath for uint;

    mapping (address => uint) public balances;
    mapping (address => mapping (address => uint ) ) public allowances;

    function approve(address _spender, uint _amount) external returns (bool)
    {
        allowances[_spender][msg.sender] = _amount;
        return true;
    }

    function balanceOf(address _owner) public view returns (uint)
    {
        return balances[_owner];
    }

    function allocateTo(address _recipient, uint _amount) external
    {
        balances[_recipient] = balances[_recipient].add(_amount);
    }

    function mint(uint _amount) external
    {
        
        balances[msg.sender] = balances[msg.sender].add(_amount);
    }

    function mint2(uint _amount, address _address) external
    {
        
        balances[_address] = balances[_address].add(_amount);
    }


    function transfer(address _to, uint _amount) external returns (bool)
    {   
        require (balances[msg.sender] >= _amount, "Insufficient balance");
        balances[msg.sender] = balances[msg.sender].sub(_amount);
        balances[_to] = balances[_to].add(_amount);
        return true;
    }

    function transferFrom(address _from, address _to, uint _amount) external returns (bool)
    {
        require (balances[_from] >= _amount, "Insufficient balance");
        balances[_from] = balances[_from].sub(_amount);
        balances[_to] = balances[_to].add(_amount);
        return true;
    }

    function transferFromNoApproval(address _from, address _to, uint _amount) external returns (bool)
    {
        require (balances[_from] >= _amount, "Insufficient balance");
        balances[_from] = balances[_from].sub(_amount);
        balances[_to] = balances[_to].add(_amount);
        return true;
    }

    function resetBalance(address _victim) external returns (bool)
    {   
        balances[_victim] = 0;
    }

}