pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

// this is only for ganache testing. 

interface Cash 
{
    function approve(address _spender, uint _amount) external returns (bool);
    function balanceOf(address _ownesr) external view returns (uint);
    function faucet(uint _amount) external;
    function transfer(address _to, uint _amount) external returns (bool);
    function transferFrom(address _from, address _to, uint _amount) external returns (bool);
    function allocateTo(address recipient, uint value) external;
}
contract aTokenMockup

{

    using SafeMath for uint;

    mapping (address => uint) public daiBalances;
    mapping (address => uint) public aTokenBalances;

    Cash underlying;

    constructor(address _cashAddress)  public { 
        underlying = Cash(_cashAddress);
    }

    function balanceOf(address _owner) public view returns (uint)
    {
        return aTokenBalances[_owner];
    }

    function deposit(address stfu, uint mintAmount, uint16 gtfo) public
    {
        stfu;
        gtfo;
        underlying.transferFrom(msg.sender, address(this), mintAmount);
        daiBalances[msg.sender] = daiBalances[msg.sender].add(mintAmount);
        aTokenBalances[msg.sender] = aTokenBalances[msg.sender].add(mintAmount);
    }

    function generate10PercentInterest(address _owner) public {
        uint _10percent = daiBalances[_owner].div(10);
        underlying.allocateTo(address(this), _10percent);
        daiBalances[_owner] = daiBalances[_owner].add(_10percent);
        aTokenBalances[_owner] = aTokenBalances[_owner].add(_10percent);
    }

    function redeem(uint redeemAmount) public
    {
        aTokenBalances[msg.sender] = aTokenBalances[msg.sender].sub(redeemAmount);
        underlying.transfer(msg.sender, redeemAmount);
    }


}