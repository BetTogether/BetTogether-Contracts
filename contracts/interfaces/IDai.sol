pragma solidity >=0.4.21 <0.7.0;


interface Dai {
    function approve(address _spender, uint256 _amount) external returns (bool);

    function balanceOf(address _ownesr) external view returns (uint256);

    function faucet(uint256 _amount) external;

    function transfer(address _to, uint256 _amount) external returns (bool);

    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    ) external returns (bool);

    function mint(uint256) external;
}
