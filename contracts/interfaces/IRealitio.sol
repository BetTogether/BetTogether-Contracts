pragma solidity >=0.4.21 <0.7.0;

interface Realitio 
{
    function askQuestion(uint256 template_id, string calldata question, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce) external payable returns (bytes32);
    function resultFor(bytes32 question_id) external view returns (bytes32);
    function isFinalized(bytes32 question_id) external view returns (bool);
}
