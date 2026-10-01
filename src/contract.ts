export const STUDENT_REGISTRATION_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_age", type: "uint256" },
      { name: "_course", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getStudent",
    stateMutability: "view",
    inputs: [{ name: "_student", type: "address" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "age", type: "uint256" },
      { name: "course", type: "string" },
    ],
  },
  {
    type: "function",
    name: "registered",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
