# Student Registration dApp

A functional React frontend for the exact `StudentRegistration` Solidity contract supplied in the assignment.

## What it implements

1. **registerStudent**
   - Connects MetaMask.
   - Calls the contract's exact `register(string,uint256,string)` function.
   - Waits for the transaction confirmation.

2. **viewRegisteredStudent**
   - Uses the connected wallet address.
   - Calls the exact `getStudent(address)` function.
   - Displays name, age and course.

3. **viewAllRegisteredStudents**
   - Uses `viem`'s `publicClient.multicall()`.
   - Sends multiple `getStudent(address)` reads as one batched RPC operation.
   - Displays all addresses known to the frontend.

## Important contract limitation

The exact contract has:

```solidity
mapping(address => Student) private students;
mapping(address => bool) public registered;
```

but it does **not** have:

- an array of registered addresses,
- a `StudentRegistered` event,
- a function that returns all registered addresses.

Therefore Solidity itself cannot answer "give me every registered address". A multicall can batch:

```text
getStudent(address1)
getStudent(address2)
getStudent(address3)
...
```

but it still needs those addresses first.

This project remembers addresses after successful registrations made through this frontend. For students registered elsewhere or before the frontend was used, add an indexer/address-discovery layer and pass those addresses into the same multicall function.

The contract itself is not modified.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create `.env`

Copy `.env.example` to `.env`.

Set:

```env
VITE_STUDENT_REGISTRATION_ADDRESS=YOUR_DEPLOYED_CONTRACT_ADDRESS
VITE_SEPOLIA_RPC_URL=YOUR_RPC_URL
```

The project is configured for Sepolia and Mainnet.

### 3. Start

```bash
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

### 4. Wallet

Use MetaMask on the same network where the contract is deployed.

## Exact contract

The frontend ABI corresponds to the supplied contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StudentRegistration {

    struct Student {
        string name;
        uint256 age;
        string course;
    }

    mapping(address => Student) private students;
    mapping(address => bool) public registered;

    function register(
        string memory _name,
        uint256 _age,
        string memory _course
    ) public {
        require(!registered[msg.sender], "Student already registered");

        students[msg.sender] = Student(
            _name,
            _age,
            _course
        );

        registered[msg.sender] = true;
    }

    function getStudent(address _student)
        public
        view
        returns (
            string memory name,
            uint256 age,
            string memory course
        )
    {
        require(registered[_student], "Student not registered");

        Student memory student = students[_student];

        return (
            student.name,
            student.age,
            student.course
        );
    }
}
```

## Assignment mapping

| Assignment requirement | Frontend implementation |
|---|---|
| Register student | `useRegisterStudent()` → `register()` |
| View logged-in student | `useLoggedInStudent()` → `getStudent(address)` |
| View all registered students | `useAllRegisteredStudents()` |
| Multicall | `publicClient.multicall({ contracts: [...] })` |
| Wallet | Injected wallet / MetaMask |
| Backend contract | Exact supplied Solidity contract |

## If you already have students registered

Because the contract has no enumerable address list, the frontend cannot magically discover old registered addresses from the mapping. You can extend `getKnownAddresses()` to load an address list from your backend/indexer, then the existing multicall code will fetch their details in a batch.

No contract change is required.
