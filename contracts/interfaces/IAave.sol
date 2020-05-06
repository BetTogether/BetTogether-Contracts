pragma solidity >=0.4.21 <0.7.0;


interface IaToken {
  function balanceOf(address _user) external view returns (uint256);

  function redeem(uint256 _amount) external;
}


interface IAaveLendingPool {
  function deposit(
    address _reserve,
    uint256 _amount,
    uint16 _referralCode
  ) external;
}


interface IAaveLendingPoolCore {}
