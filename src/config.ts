import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { sepolia, mainnet } from "wagmi/chains";

const contractAddress = import.meta.env.VITE_STUDENT_REGISTRATION_ADDRESS as
  | `0x${string}`
  | undefined;

if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
  console.warn(
    "VITE_STUDENT_REGISTRATION_ADDRESS is not configured. Add the deployed contract address to .env."
  );
}

export const STUDENT_REGISTRATION_ADDRESS =
  (contractAddress ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL || undefined),
    [mainnet.id]: http(import.meta.env.VITE_MAINNET_RPC_URL || undefined),
  },
});
