"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { useAppStore } from "@/store/jupremit";
import { Numpad } from "../ui/Numpad";

interface Props { onBack: () => void; }

const Wm = () => (
  <div aria-hidden style={{
    position: "absolute", inset: 0, zIndex: -1,
    opacity: 0.09, mixBlendMode: "screen" as const, pointerEvents: "none",
  }}>
    <Image src="/jupit-logo.png" alt="" fill sizes="390px"
      style={{ objectFit: "cover", objectPosition: "center" }} />
  </div>
);

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export default function VaultScreen({ onBack }: Props) {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection }  = useConnection();
  const { setVisible }  = useWalletModal();
  const { juicedApy, setJuicedApy } = useAppStore();

  const [input, setInput]               = useState("0");
  const [usdcBalance, setUsdcBalance]   = useState<number | null>(null);
  const [position, setPosition]         = useState<{ balanceUsdc: number; yieldEarned: number } | null>(null);
  const [posLoading, setPosLoading]     = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [status, setStatus]             = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const amount = parseFloat(input) || 0;

  const loadData = useCallback(() => {
    if (!publicKey) return;
    const wallet = publicKey.toBase58();

    fetch(`/api/balance?wallet=${wallet}&network=mainnet-beta`)
      .then(r => r.json()).then(d => setUsdcBalance(d.usdc ?? null)).catch(() => {});

    setPosLoading(true);
    fetch(`/api/position?wallet=${wallet}`)
      .then(r => r.json())
      .then(d => setPosition({ balanceUsdc: d.balanceUsdc ?? 0, yieldEarned: d.yieldEarned ?? 0 }))
      .catch(() => setPosition(null))
      .finally(() => setPosLoading(false));
  }, [publicKey?.toBase58()]);

  useEffect(() => {
    fetch("/api/apy").then(r => r.json()).then(d => setJuicedApy(d.apy ?? 4.5)).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function setPreset(val: number) {
    const rounded = Math.floor(val * 100) / 100;
    setInput(rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2));
  }

  async function handleDeposit() {
    if (!publicKey || !signTransaction || amount <= 0) return;
    setBusy(true); setStatus(null);
    try {
      const res  = await fetch("/api/lend/deposit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsdc: amount, signer: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (!res.ok || !data.transaction) throw new Error(data.error ?? "Deposit failed");

      const tx     = VersionedTransaction.deserialize(Buffer.from(data.transaction, "base64"));
      const signed = await signTransaction(tx);
      const { value: bh } = await connection.getLatestBlockhashAndContext({ commitment: "finalized" });
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      const conf = await connection.confirmTransaction(
        { signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
        "confirmed"
      );
      if (conf.value.err) throw new Error("Transaction failed on-chain");

      setStatus({ type: "success", msg: `Deposited $${amount.toFixed(2)} USDC into JUICED` });
      setInput("0");
      setTimeout(loadData, 2000);
    } catch (e: any) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    if (!publicKey || !signTransaction || amount <= 0) return;
    setBusy(true); setStatus(null);
    try {
      const res  = await fetch("/api/lend/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsdc: amount, signer: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (!res.ok || !data.transaction) throw new Error(data.error ?? "Withdraw failed");

      const tx     = VersionedTransaction.deserialize(Buffer.from(data.transaction, "base64"));
      const signed = await signTransaction(tx);
      const { value: bh } = await connection.getLatestBlockhashAndContext({ commitment: "finalized" });
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      const conf = await connection.confirmTransaction(
        { signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
        "confirmed"
      );
      if (conf.value.err) throw new Error("Transaction failed on-chain");

      setStatus({ type: "success", msg: `Withdrew $${amount.toFixed(2)} USDC from JUICED` });
      setInput("0");
      setTimeout(loadData, 2000);
    } catch (e: any) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (!connected) return (
    <div style={{ position: "relative", zIndex: 0 }}>
      <Wm />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        background: "var(--bg)", position: "sticky" as const, top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 12, border: "1px solid var(--border)",
          background: "var(--surface2)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", color: "var(--text2)",
        }}><BackArrow /></button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Savings Vault</span>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--purple-bg)", border: "1px solid var(--purple-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Connect wallet to use Vault</div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
          Earn <strong style={{ color: "var(--purple)" }}>{juicedApy}% APY</strong> on your USDC via Jupiter Lend. Withdraw anytime.
        </div>
        <button className="btn-primary" style={{ maxWidth: 200, background: "var(--purple)", color: "#fff", marginTop: 8 }}
          onClick={() => setVisible(true)}>Connect Wallet</button>
      </div>
    </div>
  );

  const posBalance = position?.balanceUsdc ?? 0;
  const posYield   = position?.yieldEarned ?? 0;

  return (
    <div style={{ position: "relative", zIndex: 0, display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Wm />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        background: "var(--bg)", position: "sticky" as const, top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 12, border: "1px solid var(--border)",
          background: "var(--surface2)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", color: "var(--text2)",
        }}><BackArrow /></button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Savings Vault</span>
        <div style={{ width: 36 }} />
      </div>

      {/* APY + position card */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{
          background: "var(--purple-bg)", border: "1px solid var(--purple-b)",
          borderRadius: 20, padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 3 }}>JUICED APY</div>
            <div className="num grad-purple" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>{juicedApy}%</div>
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>via Jupiter Lend</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 3 }}>Your Balance</div>
            {posLoading ? (
              <div style={{ fontSize: 11, color: "var(--text3)" }}>Loading…</div>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, color: posBalance > 0 ? "var(--purple)" : "var(--text3)", letterSpacing: "-0.02em" }}>
                  ${posBalance.toFixed(2)}
                </div>
                {posYield > 0 && (
                  <div style={{ fontSize: 11, color: "var(--green)", marginTop: 2 }}>
                    +${posYield.toFixed(4)} yield
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Amount display */}
      <div style={{ padding: "20px 16px 4px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Amount (USDC)</div>
        {(() => {
          const digits = input.replace(".", "").length;
          const numFs  = digits <= 3 ? 52 : digits <= 5 ? 44 : digits <= 7 ? 36 : 30;
          const dolFs  = Math.round(numFs * 0.5);
          return (
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: dolFs, fontWeight: 600, lineHeight: 1,
                color: amount > 0 ? "rgba(168,156,255,0.45)" : "var(--text3)" }}>$</span>
              <span className="num" style={{
                fontSize: numFs, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em",
                ...(amount > 0 ? {
                  background: "linear-gradient(175deg, #C8C0FF 0%, #8A7DFF 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                } : { color: "var(--text3)" }),
              }}>{input}</span>
            </div>
          );
        })()}
        {usdcBalance !== null && (
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
            Wallet: <span style={{ color: "var(--text2)", fontWeight: 600 }}>${usdcBalance.toFixed(2)} USDC</span>
          </div>
        )}
      </div>

      {/* Numpad + quick % column */}
      <div style={{ padding: "14px 16px 8px", display: "flex", gap: 8 }}>
        {/* Quick deposit chips */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, width: 56 }}>
          {([
            { label: "25%", pct: 0.25 },
            { label: "50%", pct: 0.50 },
            { label: "75%", pct: 0.75 },
            { label: "MAX", pct: 1.00 },
          ] as const).map(({ label, pct }) => {
            const walletVal = usdcBalance ? Math.floor(usdcBalance * pct * 100) / 100 : 0;
            const dim = !usdcBalance || usdcBalance <= 0;
            return (
              <button key={label} onClick={() => !dim && setPreset(walletVal)} style={{
                height: 64, borderRadius: 16, width: "100%",
                border: `1px solid ${!dim && Math.abs(amount - walletVal) < 0.01 ? "var(--purple-b)" : "var(--border)"}`,
                background: !dim && Math.abs(amount - walletVal) < 0.01 ? "var(--purple-bg)" : "var(--surface)",
                color: !dim && Math.abs(amount - walletVal) < 0.01 ? "var(--purple)" : dim ? "var(--text3)" : "var(--text2)",
                cursor: dim ? "default" : "pointer", fontFamily: "inherit",
                fontSize: 11, fontWeight: 700, opacity: dim ? 0.4 : 1,
                display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 2,
              }}>
                <span>{label}</span>
                {!dim && <span style={{ fontSize: 8, fontWeight: 600, color: "var(--text3)" }}>${walletVal.toFixed(0)}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }}>
          <Numpad value={input} onChange={setInput} />
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div style={{
          margin: "0 16px 8px",
          background: status.type === "success" ? "var(--green-bg)" : "var(--red-bg)",
          border: `1px solid ${status.type === "success" ? "var(--green-b)" : "var(--red-b)"}`,
          borderRadius: 12, padding: "10px 14px",
          fontSize: 12, color: status.type === "success" ? "var(--green)" : "var(--red)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>{status.type === "success" ? "✓" : "⚠"}</span>
          <span>{status.msg}</span>
        </div>
      )}

      {/* Deposit / Withdraw buttons */}
      <div style={{ padding: "0 16px 24px", display: "flex", gap: 10 }}>
        <button
          className="btn-primary"
          style={{ flex: 1, background: "var(--purple)", color: "#fff", opacity: busy || amount <= 0 ? 0.5 : 1 }}
          disabled={busy || amount <= 0}
          onClick={handleDeposit}
        >
          {busy ? "…" : `Deposit $${amount > 0 ? amount.toFixed(2) : "0"}`}
        </button>
        <button
          className="btn-primary"
          style={{
            flex: 1, background: "var(--surface2)", color: "var(--purple)",
            border: "1px solid var(--purple-b)",
            opacity: busy || amount <= 0 || posBalance <= 0 ? 0.5 : 1,
          }}
          disabled={busy || amount <= 0 || posBalance <= 0}
          onClick={handleWithdraw}
        >
          {busy ? "…" : `Withdraw $${amount > 0 ? amount.toFixed(2) : "0"}`}
        </button>
      </div>
    </div>
  );
}
