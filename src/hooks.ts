import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPublicClient } from "wagmi/actions";
import { wagmiConfig, STUDENT_REGISTRATION_ADDRESS } from "./config";
import { STUDENT_REGISTRATION_ABI } from "./contract";
import type { Address } from "viem";

export type Student = {
  address: Address;
  name: string;
  age: bigint;
  course: string;
};

const STORAGE_KEY = "student-registration:known-addresses";

export function getKnownAddresses(): Address[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Address[];
  } catch {
    return [];
  }
}

export function rememberAddress(address: Address) {
  const normalized = address.toLowerCase();
  const current = getKnownAddresses();
  if (!current.some((a) => a.toLowerCase() === normalized)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, address]));
  }
}

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  return {
    address,
    isConnected,
    connect: () => connect({ connector: connectors[0] }),
    disconnect,
    isConnecting: isPending,
  };
}

export function useRegisterStudent() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const register = (name: string, age: bigint, course: string) => {
    if (!address) throw new Error("Connect your wallet first.");

    writeContract(
      {
        address: STUDENT_REGISTRATION_ADDRESS,
        abi: STUDENT_REGISTRATION_ABI,
        functionName: "register",
        args: [name, age, course],
      },
      {
        onSuccess: () => {
          rememberAddress(address);
          queryClient.invalidateQueries();
        },
      }
    );
  };

  return {
    register,
    hash,
    isPending,
    isConfirmed: receipt.isSuccess,
    isConfirming: receipt.isLoading,
    error,
    receiptError: receipt.error,
  };
}

export function useLoggedInStudent() {
  const { address } = useAccount();

  return useReadContract({
    address: STUDENT_REGISTRATION_ADDRESS,
    abi: STUDENT_REGISTRATION_ABI,
    functionName: "getStudent",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
      retry: false,
    },
  });
}

export function useAllRegisteredStudents() {
  const chainId = useChainId();

  return useQuery({
    queryKey: ["all-registered-students", chainId],
    queryFn: async (): Promise<Student[]> => {
      const addresses = getKnownAddresses();

      if (addresses.length === 0) return [];

      const publicClient = getPublicClient(wagmiConfig, { chainId });
      if (!publicClient) throw new Error("No public client for this network.");

      // This is the requested multicall: every getStudent call is batched
      // into one RPC-level multicall request.
      const results = await publicClient.multicall({
        contracts: addresses.map((address) => ({
          address: STUDENT_REGISTRATION_ADDRESS,
          abi: STUDENT_REGISTRATION_ABI,
          functionName: "getStudent",
          args: [address],
        })),
        allowFailure: true,
      });

      return results.flatMap((result, index) => {
        if (result.status !== "success") return [];

        const [name, age, course] = result.result as readonly [
          string,
          bigint,
          string
        ];

        return [{ address: addresses[index], name, age, course }];
      });
    },
    enabled:
      STUDENT_REGISTRATION_ADDRESS !==
      "0x0000000000000000000000000000000000000000",
  });
}
