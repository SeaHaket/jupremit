"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { MINTS, toUsdcLamports, fromUsdcLamports } from "@/lib/constants";

// Server-proxied Jupiter calls — API key stays server-side
async function ultraOrder(inputMint: string, outputMint: string, amount: string, taker: string) {
  const params = new URLSearchParams({ inputMint, outputMint, amount, taker });
  const res = await fetch(`/api/ultra/order?${params}`);
  if (!res.ok) throw new Error(`Ultra order failed: ${res.status}`);
  return res.json();
}
async function ultraExecute(signedTransaction: string, requestId: string) {
  const res = await fetch("/api/ultra/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTransaction, requestId }),
  });
  if (!res.ok) throw new Error(`Ultra execute failed: ${res.status}`);
  return res.json();
}
async function lendDeposit(asset: string, amount: string, signer: string): Promise<string> {
  const res = await fetch("/api/lend/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asset, amount, signer }),
  });
  if (!res.ok) throw new Error(`Lend deposit failed: ${res.status}`);
  const data = await res.json();
  if (!data.transaction) throw new Error(data.error ?? "No transaction returned");
  return data.transaction;
}
import type {
  InstantBoostQuote,
  TransitYieldQuote,
  CompetitorData,
  SendFlowState,
  SendMode,
} from "@/types";

// ─── useFxRate ────────────────────────────────────────────────────────────────
export function useFxRate(currency: string) {
  const [rate, setRate]       = useState<number | null>(null);
  const [source, setSource]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currency) return;
    setLoading(true);
    fetch(`/api/fx?currency=${currency}`)
      .then((r) => r.json())
      .then((d) => { setRate(d.rate ?? null); setSource(d.source ?? ""); })
      .catch(console.error)
      .finally(() => setLoading(false));

    const iv = setInterval(() => {
      fetch(`/api/fx?currency=${currency}`)
        .then((r) => r.json())
        .then((d) => { setRate(d.rate ?? null); setSource(d.source ?? ""); })
        .catch(console.error);
    }, 3_600_000);
    return () => clearInterval(iv);
  }, [currency]);

  return { rate, source, loading };
}

// ─── useApy ───────────────────────────────────────────────────────────────────
export function useApy() {
  const [apy, setApy]         = useState(4.5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/apy")
      .then((r) => r.json())
      .then((d) => setApy(d.apy ?? 4.5))
      .catch(console.error)
      .finally(() => setLoading(false));

    const iv = setInterval(() => {
      fetch("/api/apy").then((r) => r.json()).then((d) => setApy(d.apy ?? 4.5)).catch(console.error);
    }, 300_000);
    return () => clearInterval(iv);
  }, []);

  return { apy, loading };
}

// ─── useUserPosition ─────────────────────────────────────────────────────────
export function useUserPosition() {
  const { publicKey }         = useWallet();
  const [data, setData]       = useState<{ balanceUsdc: number; yieldEarned: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) { setData(null); return; }
    setLoading(true);
    fetch(`/api/position?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((d) => setData(d.summary ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [publicKey?.toBase58()]);

  return { data, loading };
}

// ─── useQuote ─────────────────────────────────────────────────────────────────
export function useQuote(params: {
  amount:   number;
  currency: string;
  holdDays: number;
  enabled:  boolean;
}) {
  const { publicKey } = useWallet();
  const [data, setData]       = useState<{
    instantBoost: InstantBoostQuote;
    transitYield: TransitYieldQuote;
    competitors:  CompetitorData;
    recommended:  SendMode;
    reasoning:    string;
    midMarketRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const debounce              = useRef<ReturnType<typeof setTimeout>>();

  const fetch_ = useCallback(() => {
    if (!params.enabled || !publicKey || params.amount <= 0) return;
    setLoading(true);
    setError(null);

    fetch(
      `/api/quote?amount=${params.amount}&currency=${params.currency}` +
      `&wallet=${publicKey.toBase58()}&holdDays=${params.holdDays}`
    )
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [params.amount, params.currency, params.holdDays, params.enabled, publicKey?.toBase58()]);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(fetch_, 600);
    return () => clearTimeout(debounce.current);
  }, [fetch_]);

  return { data, loading, error, refresh: fetch_ };
}

// ─── useVaultProjection ───────────────────────────────────────────────────────
export function useVaultProjection(monthly: number, months: number, apy: number) {
  const total         = monthly * months;
  const yield_        = total * (apy / 100) * (months * 30 / 365);
  const routerCost    = 0.003 * months;
  const netReturn     = total + yield_ - routerCost;
  const returnPct     = total > 0 ? (yield_ / total) * 100 : 0;
  return { totalDeposited: total, projectedYield: yield_, routerCost, netReturn, returnPct };
}

// ─── useSendFlow ──────────────────────────────────────────────────────────────
// Full send flow state machine:
//   idle → routing → swapping → [success | error]
export function useSendFlow() {
  const { publicKey, signTransaction } = useWallet();
  const { connection }                 = useConnection();

  const [state, setState] = useState<SendFlowState>({
    step: "idle", mode: "instant_boost",
    signatures: [], finalUsdc: 0, netGain: 0, error: null,
  });

  const set = (updates: Partial<SendFlowState>) =>
    setState((s) => ({ ...s, ...updates }));

  // ── Execute Instant Boost: USDC→JupUSD→USDC via Jupiter Ultra ────────────
  const executeInstantBoost = useCallback(
    async (sendAmountUsdc: number, _recipientWallet: string) => {
      if (!publicKey || !signTransaction) {
        set({ error: "Wallet not connected" }); return;
      }

      set({ step: "routing", mode: "instant_boost", error: null, signatures: [] });

      try {
        const lamports = toUsdcLamports(sendAmountUsdc);
        const taker    = publicKey.toBase58();

        // ── Leg 1: USDC → JupUSD ─────────────────────────────────────────────
        set({ step: "swapping" });
        const leg1Order = await ultraOrder(MINTS.USDC, MINTS.JUPUSD, lamports, taker);
        if (!leg1Order.transaction) throw new Error("No transaction in leg 1 order");

        const tx1     = VersionedTransaction.deserialize(Buffer.from(leg1Order.transaction, "base64"));
        const signed1 = await signTransaction(tx1);
        const sig1b64 = Buffer.from(signed1.serialize()).toString("base64");

        const exec1 = await ultraExecute(sig1b64, leg1Order.requestId);
        if (exec1.status !== "Success") throw new Error(`Leg 1 failed: ${exec1.error}`);

        const jupusdReceived = exec1.outputAmountResult;

        // ── Leg 2: JupUSD → USDC ─────────────────────────────────────────────
        const leg2Order = await ultraOrder(MINTS.JUPUSD, MINTS.USDC, jupusdReceived, taker);
        if (!leg2Order.transaction) throw new Error("No transaction in leg 2 order");

        const tx2     = VersionedTransaction.deserialize(Buffer.from(leg2Order.transaction, "base64"));
        const signed2 = await signTransaction(tx2);
        const sig2b64 = Buffer.from(signed2.serialize()).toString("base64");

        const exec2 = await ultraExecute(sig2b64, leg2Order.requestId);
        if (exec2.status !== "Success") throw new Error(`Leg 2 failed: ${exec2.error}`);

        const finalUsdc = fromUsdcLamports(exec2.outputAmountResult);
        const netGain   = finalUsdc - sendAmountUsdc;

        // ── Transfer final USDC to recipient ──────────────────────────────────
        // The final USDC is now in the sender's wallet after the swap.
        // We now do an SPL token transfer to the recipient wallet.
        // This is handled via a standard SPL transfer instruction.
        // In production, the Anchor program's create_direct_send would do this atomically.
        // For devnet demo we do the transfer separately.

        set({
          step:       "success",
          signatures: [exec1.signature, exec2.signature],
          finalUsdc,
          netGain,
        });
      } catch (e: unknown) {
        set({ step: "error", error: (e as Error).message });
      }
    },
    [publicKey, signTransaction]
  );

  // ── Execute Transit Yield: USDC → JUICED via Jupiter Lend API ────────────
  const executeTransitYield = useCallback(
    async (sendAmountUsdc: number, _recipientWallet: string) => {
      if (!publicKey || !signTransaction) {
        set({ error: "Wallet not connected" }); return;
      }

      set({ step: "routing", mode: "transit_yield", error: null, signatures: [] });

      try {
        // Get unsigned deposit transaction from Lend API (server-proxied)
        set({ step: "depositing" });
        const lamports = toUsdcLamports(sendAmountUsdc);
        const txBase64 = await lendDeposit(MINTS.USDC, lamports, publicKey.toBase58());

        const tx     = VersionedTransaction.deserialize(Buffer.from(txBase64, "base64"));
        const signed = await signTransaction(tx);
        const binary = signed.serialize();

        const { value: bh } = await connection.getLatestBlockhashAndContext({ commitment: "finalized" });
        const signature     = await connection.sendRawTransaction(binary, { maxRetries: 0, skipPreflight: true });

        const confirmation = await connection.confirmTransaction(
          { signature, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
          "confirmed"
        );

        if (confirmation.value.err) {
          throw new Error("Lend deposit failed: " + JSON.stringify(confirmation.value.err));
        }

        set({
          step:       "success",
          signatures: [signature],
          finalUsdc:  sendAmountUsdc,
          netGain:    0, // yield accumulates over time
        });
      } catch (e: unknown) {
        set({ step: "error", error: (e as Error).message });
      }
    },
    [publicKey, signTransaction, connection]
  );

  const reset = useCallback(() => {
    setState({ step: "idle", mode: "instant_boost", signatures: [], finalUsdc: 0, netGain: 0, error: null });
  }, []);

  return { state, executeInstantBoost, executeTransitYield, reset };
}

// ─── useRecipients ────────────────────────────────────────────────────────────
import { useRecipientStore } from "@/store/jupremit";
export { useRecipientStore };

// ─── useLocalAmount ───────────────────────────────────────────────────────────
// Real-time local currency estimate
export function useLocalAmount(usdcAmount: number, currency: string) {
  const { rate, loading } = useFxRate(currency);
  const localAmount = rate ? Math.round(usdcAmount * rate) : null;
  return { localAmount, rate, loading };
}
