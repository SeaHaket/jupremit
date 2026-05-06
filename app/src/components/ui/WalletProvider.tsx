"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, Cluster } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "mainnet-beta") as Cluster;
// Use NEXT_PUBLIC_RPC_ENDPOINT for a key-less public endpoint only.
// Never put a secret API key in NEXT_PUBLIC_* — it ships to the browser bundle.
// Server-side routes use RPC_URL (non-public env var) for privileged RPC calls.
const RPC_URL = process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? clusterApiUrl(NETWORK);

export function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    // Jupiter wallet is auto-detected via wallet-standard
    // No explicit adapter needed — it registers itself
  ], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
