export const CONTRACT_ADDRESS = "0xa551cb621e1b7b2350049d842bf73C1c4e89a126";
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11"; // same address on Sepolia
export const SEPOLIA_CHAIN_ID = 11155111;

export const STUDENT_ABI = [
  "function register(string _name, uint256 _age, string _course)",
  "function getStudent(address _student) view returns (string name, uint256 age, string course)",
  "function registered(address) view returns (bool)",
];

export const MULTICALL_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)",
];
