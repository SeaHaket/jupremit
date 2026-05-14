"use client";
import { useState, useEffect, lazy, Suspense } from "react";
import Image from "next/image";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useRecipientStore, useAppStore, useTimedSendStore, useTxHistoryStore } from "@/store/jupremit";
import { Numpad } from "../ui/Numpad";
import { COUNTRIES, PROVIDERS_BY_COUNTRY, CURRENCY_SYMBOLS } from "@/lib/constants";
import dynamic from "next/dynamic";

const QrScannerModal = dynamic(
  () => import("../ui/QrScannerModal").then(m => ({ default: m.QrScannerModal })),
  { ssr: false }
);
const FonbnkCashoutModal = dynamic(
  () => import("../ui/FonbnkCashoutModal").then(m => ({ default: m.FonbnkCashoutModal })),
  { ssr: false }
);

const PROTOCOL_FEE_BPS  = 20;                           // 0.20 %
const FEE_WALLET        = process.env.NEXT_PUBLIC_FEE_WALLET ?? "";
const SOL_PUBKEY_RE     = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type Tab  = "instant" | "timed";
type Step = "amount" | "review" | "executing" | "success" | "error";

interface Props { onBack: () => void; }

function msToCountdown(ms: number): string {
  if (ms <= 0) return "Ready to release";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

const Wm = () => (
  <div aria-hidden style={{
    position: "absolute", inset: 0, zIndex: -1,
    opacity: 0.09, mixBlendMode: "screen" as const, pointerEvents: "none",
  }}>
    <Image src="/jupit-logo.png" alt="" fill sizes="390px"
      style={{ objectFit: "cover", objectPosition: "center" }} />
  </div>
);

// ─── Icons ────────────────────────────────────────────────────────────────────
function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ScanQrIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="4" height="4" rx="0.5" />
      <rect x="13" y="7" width="4" height="4" rx="0.5" />
      <rect x="7" y="13" width="4" height="4" rx="0.5" />
      <path d="M13 17h4v-4" />
    </svg>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Hdr({ title, back, action }: { title: string; back: () => void; action?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px", borderBottom: "1px solid var(--border)",
      background: "var(--bg)", position: "sticky" as const, top: 0, zIndex: 10,
    }}>
      <button onClick={back} style={{
        width: 36, height: 36, borderRadius: 12, border: "1px solid var(--border)",
        background: "var(--surface2)", display: "flex", alignItems: "center",
        justifyContent: "center", cursor: "pointer", color: "var(--text2)",
      }}>
        <BackArrow />
      </button>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</span>
      {action ?? <div style={{ width: 36 }} />}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SendScreen({ onBack }: Props) {
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const { defaultRecipient, addRecipient, recipients } = useRecipientStore();
  const { sendAmount, setSendAmount, holdDays, setHoldDays, juicedApy, setJuicedApy } = useAppStore();
  const { timedSends, addTimedSend, markReleased, markFailed, removeTimedSend } = useTimedSendStore();
  const { addTx } = useTxHistoryStore();

  const [tab, setTab]               = useState<Tab>("instant");
  const [step, setStep]             = useState<Step>("amount");
  const [input, setInput]           = useState(sendAmount > 0 ? sendAmount.toString() : "0");
  const [displayCountryCode, setDisplayCountryCode] = useState(defaultRecipient?.country ?? "PH");
  const [showScanner, setShowScanner]     = useState(false);
  const [scannedWallet, setScannedWallet] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm]   = useState(false);
  const [saveName, setSaveName]           = useState("");
  const [saveCountryCode, setSaveCountryCode] = useState("PH");
  const [saveProvider, setSaveProvider]   = useState("");
  const [addressSaved, setAddressSaved]   = useState(false);
  const [quote, setQuote]           = useState<any>(null);
  const [sendResult, setSendResult] = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [txSigs, setTxSigs]         = useState<string[]>([]);
  const [errMsg, setErrMsg]         = useState("");
  const [execStatus, setExecStatus] = useState("");
  const [fxRate, setFxRate]         = useState(61.16);
  const [now, setNow]               = useState(Date.now());
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [showCashout, setShowCashout] = useState(false);

  const currency    = defaultRecipient?.currency ?? "PHP";
  const sym         = CURRENCY_SYMBOLS[currency] ?? "$";
  const countryData = COUNTRIES.find(c => c.code === (defaultRecipient?.country ?? ""));
  const providers   = PROVIDERS_BY_COUNTRY[defaultRecipient?.country ?? ""] ?? [];
  const effectiveWallet = scannedWallet ?? defaultRecipient?.wallet;
  // Compute in lamports first to avoid floating-point rounding at sub-cent amounts
  const totalRaw = Math.round(sendAmount * 1_000_000);
  const feeRaw   = Math.max(1, Math.round(totalRaw * PROTOCOL_FEE_BPS / 10_000));
  const netRaw   = totalRaw - feeRaw;
  const feeUsdc  = feeRaw / 1_000_000;
  const netUsdc  = netRaw / 1_000_000;

  // Display country drives FX preview — independent of saved recipient
  const displayCountry   = COUNTRIES.find(c => c.code === displayCountryCode) ?? COUNTRIES[0];
  const displayCurrency  = displayCountry.currency;
  const displaySym       = CURRENCY_SYMBOLS[displayCurrency] ?? "$";

  useEffect(() => {
    fetch(`/api/fx?currency=${displayCurrency}`)
      .then(r => r.json()).then(d => setFxRate(d.rate ?? 61.16)).catch(() => {});
    fetch("/api/apy")
      .then(r => r.json()).then(d => setJuicedApy(d.apy ?? 4.5)).catch(() => {});
  }, [displayCurrency]);

  useEffect(() => {
    if (!publicKey) return;
    fetch(`/api/balance?wallet=${publicKey.toBase58()}&network=mainnet-beta`)
      .then(r => r.json()).then(d => setUsdcBalance(d.usdc ?? null)).catch(() => {});
  }, [publicKey?.toBase58()]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  function handleSaveAddress() {
    if (!scannedWallet || !saveName.trim()) return;
    const c = COUNTRIES.find(x => x.code === saveCountryCode) ?? COUNTRIES[0];
    addRecipient({
      name: saveName.trim(),
      country: saveCountryCode,
      currency: c.currency,
      provider: saveProvider || "USDC wallet",
      wallet: scannedWallet,
      flag: c.flag,
      isDefault: recipients.length === 0,
    });
    setAddressSaved(true);
    setShowSaveForm(false);
    setSaveName("");
    setTimeout(() => setAddressSaved(false), 2500);
  }

  function handleNumpad(v: string) {
    setInput(v);
    const n = parseFloat(v);
    if (!isNaN(n) && n >= 0) setSendAmount(n);
  }

  function setPreset(a: number) {
    const rounded = Math.floor(a * 100) / 100;
    const str = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2);
    setInput(str);
    setSendAmount(rounded);
  }

  function pctOfBalance(pct: number): number {
    if (!usdcBalance || usdcBalance <= 0) return 0;
    return Math.floor(usdcBalance * pct * 100) / 100;
  }

  const fetchQuote = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/quote?amount=${sendAmount}&currency=${currency}&holdDays=${holdDays}`);
      const data = await res.json();
      setQuote(data);
    } catch {}
    setLoading(false);
  };

  /* ─── Sign + send a Jupiter VersionedTransaction ──────────────────────────── */
  const signAndSend = async (base64Tx: string): Promise<string> => {
    const tx     = VersionedTransaction.deserialize(Buffer.from(base64Tx, "base64"));
    const signed = await signTransaction!(tx as any);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const sig    = await connection.sendRawTransaction((signed as any).serialize(), { skipPreflight: false, maxRetries: 3 });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  };

  /* ─── SPL direct USDC transfer (net to recipient + optional fee in one tx) ── */
  const doDirectTransfer = async (
    fromPub: PublicKey, toPub: PublicKey, netTransferRaw: number, protocolFeeRaw = 0
  ): Promise<string> => {
    const { createTransferInstruction, getAssociatedTokenAddress,
            createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID }
      = await import("@solana/spl-token");
    const USDC    = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const fromAta = await getAssociatedTokenAddress(USDC, fromPub);
    const toAta   = await getAssociatedTokenAddress(USDC, toPub);
    const tx      = new Transaction();

    let toAtaExists = false;
    try { toAtaExists = !!(await connection.getAccountInfo(toAta)); } catch {}
    if (!toAtaExists)
      tx.add(createAssociatedTokenAccountInstruction(fromPub, toAta, toPub, USDC));

    tx.add(createTransferInstruction(fromAta, toAta, fromPub, BigInt(netTransferRaw), [], TOKEN_PROGRAM_ID));

    // Bundle protocol fee in the same tx (one wallet approval)
    if (protocolFeeRaw > 0 && FEE_WALLET) {
      const feePub = new PublicKey(FEE_WALLET);
      const feeAta = await getAssociatedTokenAddress(USDC, feePub);
      let feeAtaExists = false;
      try { feeAtaExists = !!(await connection.getAccountInfo(feeAta)); } catch {}
      if (!feeAtaExists)
        tx.add(createAssociatedTokenAccountInstruction(fromPub, feeAta, feePub, USDC));
      tx.add(createTransferInstruction(fromAta, feeAta, fromPub, BigInt(protocolFeeRaw), [], TOKEN_PROGRAM_ID));
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPub;
    const signed = await signTransaction!(tx as any);
    const sig    = await connection.sendRawTransaction((signed as any).serialize(), { skipPreflight: false, maxRetries: 3 });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  };

  /* ─── INSTANT BOOST execution ─────────────────────────────────────────────── */
  const executeInstantSend = async () => {
    if (!publicKey || !signTransaction || !effectiveWallet) {
      setErrMsg("Wallet not connected or no recipient."); setStep("error"); return;
    }
    setStep("executing"); setErrMsg(""); setTxSigs([]);
    try {
      setExecStatus("Checking best route via Jupiter Ultra…");
      const res  = await fetch("/api/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderWallet: publicKey.toBase58(), recipientWallet: effectiveWallet, amountUsdc: netUsdc }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Route check failed");
      setSendResult(data);

      const toName = scannedWallet ? "Scanned address" : defaultRecipient?.name;
      if (data.strategy === "instant_boost") {
        setExecStatus("Instant Boost active — approve in wallet…");
        const sig = await signAndSend(data.tx);
        // Collect protocol fee separately (Jupiter tx is opaque — fee stays in sender wallet)
        if (feeRaw > 0 && FEE_WALLET) {
          setExecStatus("Collecting protocol fee — approve in wallet…");
          await doDirectTransfer(publicKey, new PublicKey(FEE_WALLET), feeRaw, 0);
        }
        setTxSigs([sig]);
        addTx({ type: "instant_send", amountUsdc: sendAmount, feeUsdc, txSig: sig, ts: Date.now(), toName, toWallet: effectiveWallet, strategy: "instant_boost" });
      } else {
        setExecStatus("Sending USDC directly — approve in wallet…");
        const recipientPub = new PublicKey(effectiveWallet);
        const sig = await doDirectTransfer(publicKey, recipientPub, netRaw, feeRaw);
        setTxSigs([sig]);
        addTx({ type: "instant_send", amountUsdc: sendAmount, feeUsdc, txSig: sig, ts: Date.now(), toName, toWallet: effectiveWallet, strategy: "direct" });
      }
      setStep("success");
    } catch (e: any) {
      const msg = e?.message ?? "Transaction failed";
      setErrMsg(
        msg.includes("rejected") || msg.includes("User rejected") ? "You cancelled the transaction." :
        msg.includes("insufficient") || msg.includes("0x1") ? "Insufficient USDC or SOL balance." :
        msg.includes("blockhash") ? "Transaction expired — please try again." : msg
      );
      setStep("error");
    }
  };

  /* ─── TIMED SEND: Deposit into JUICED ─────────────────────────────────────── */
  const executeTimedDeposit = async () => {
    if (!publicKey || !signTransaction || !effectiveWallet) {
      setErrMsg("Wallet not connected or no recipient."); setStep("error"); return;
    }
    setStep("executing"); setErrMsg(""); setTxSigs([]);
    try {
      setExecStatus(`Depositing $${netUsdc.toFixed(2)} USDC into JUICED (${holdDays}-day hold)…`);
      const res  = await fetch("/api/time-send/deposit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderWallet: publicKey.toBase58(), amountUsdc: netUsdc }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Deposit failed");

      setExecStatus("Approve the Jupiter Lend deposit in your wallet…");
      const sig = await signAndSend(data.transaction);
      // Collect protocol fee separately (Lend deposit tx is opaque — fee stays in sender wallet)
      if (feeRaw > 0 && FEE_WALLET) {
        setExecStatus("Collecting protocol fee — approve in wallet…");
        await doDirectTransfer(publicKey, new PublicKey(FEE_WALLET), feeRaw, 0);
      }
      setTxSigs([sig]);
      addTx({ type: "timed_deposit", amountUsdc: sendAmount, feeUsdc, txSig: sig, ts: Date.now(), toName: scannedWallet ? "Scanned address" : defaultRecipient?.name, toWallet: effectiveWallet });

      const matureAt = Date.now() + holdDays * 86_400_000;
      addTimedSend({
        recipientWallet:   defaultRecipient.wallet,
        recipientName:     defaultRecipient.name,
        recipientFlag:     defaultRecipient.flag,
        recipientProvider: defaultRecipient.provider,
        amountUsdc:        sendAmount,
        depositTxSig:      sig,
        depositedAt:       Date.now(),
        matureAt,
        holdDays:          holdDays as 5 | 15 | 30,
        juicedAmountRaw:   data.amountRaw,
        status:            "active",
      });

      setSendResult({ strategy: "timed", holdDays, matureAt, amountUsdc: sendAmount });
      setStep("success");
    } catch (e: any) {
      const msg = e?.message ?? "Deposit failed";
      setErrMsg(
        msg.includes("rejected") || msg.includes("User rejected") ? "You cancelled the transaction." :
        msg.includes("insufficient") ? "Insufficient USDC or SOL balance." : msg
      );
      setStep("error");
    }
  };

  /* ─── TIMED SEND: Release to recipient ────────────────────────────────────── */
  const releaseTimedSend = async (tsId: string) => {
    const ts = timedSends.find(t => t.id === tsId);
    if (!ts || !publicKey || !signTransaction) return;
    setReleasingId(tsId);
    try {
      const res  = await fetch("/api/time-send/release", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderWallet:      publicKey.toBase58(),
          juicedAmountRaw:   ts.juicedAmountRaw,
          originalAmountRaw: Math.round(ts.amountUsdc * 1_000_000),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Withdraw failed");

      if (!SOL_PUBKEY_RE.test(ts.recipientWallet))
        throw new Error("Stored recipient wallet address is invalid");
      const withdrawSig  = await signAndSend(data.transaction);
      const recipientPub = new PublicKey(ts.recipientWallet);
      // Bundle yield fee in same tx as recipient transfer (one approval)
      const transferSig  = await doDirectTransfer(publicKey, recipientPub, data.senderGetsRaw, data.feeRaw ?? 0);
      addTx({ type: "timed_release", amountUsdc: ts.amountUsdc, feeUsdc: data.feeUsdc ?? 0, txSig: transferSig, ts: Date.now(), toName: ts.recipientName, toWallet: ts.recipientWallet, yieldUsdc: data.yieldUsdc ?? 0 });

      markReleased(tsId, transferSig, data.yieldUsdc ?? 0);
    } catch (e: any) {
      console.error("Release failed:", e.message);
      markFailed(tsId);
      alert(`Release failed: ${e.message}`);
    }
    setReleasingId(null);
  };

  // ─── Not connected ──────────────────────────────────────────────────────────
  if (!publicKey) return (
    <div style={{ position: "relative", zIndex: 0 }}>
      <Wm />
      <Hdr title="Send Money" back={onBack} />
      <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--green-bg)", border: "1px solid var(--green-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>↗</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Connect wallet to send</div>
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>Connect your Solana wallet to send USDC globally at near-zero cost.</div>
        <button className="btn-primary" style={{ maxWidth: 220 }} onClick={() => setVisible(true)}>Connect Wallet</button>
      </div>
    </div>
  );

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (step === "error") return (
    <div style={{ position: "relative", zIndex: 0 }}>
      <Wm />
      <Hdr title="Send Money" back={() => setStep("review")} />
      <div style={{ padding: 24, textAlign: "center", paddingTop: 48 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>❌</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--red)", marginBottom: 12 }}>Failed</div>
        <div style={{ fontSize: 12, color: "var(--text2)", background: "var(--red-bg)", border: "1px solid var(--red-b)", borderRadius: 12, padding: "12px 16px", lineHeight: 1.6, marginBottom: 20 }}>{errMsg}</div>
        <button className="btn-primary" style={{ maxWidth: 200, margin: "0 auto 10px" }} onClick={() => setStep("review")}>Try again</button><br />
        <button onClick={onBack} style={{ fontSize: 13, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", marginTop: 8 }}>← Back</button>
      </div>
    </div>
  );

  // ─── Executing ──────────────────────────────────────────────────────────────
  if (step === "executing") return (
    <div style={{ position: "relative", zIndex: 0 }}>
      <Wm />
      <Hdr title="Sending…" back={() => {}} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 64, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, border: "3px solid var(--green)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Processing…</div>
        <div style={{ fontSize: 13, color: "var(--text2)" }}>{execStatus}</div>
        <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-b)", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "var(--amber)" }}>
          Check your wallet — one approval needed
        </div>
      </div>
    </div>
  );

  // ─── Success ────────────────────────────────────────────────────────────────
  if (step === "success") return (
    <div style={{ position: "relative", zIndex: 0 }}>
      {showCashout && effectiveWallet && (
        <FonbnkCashoutModal
          walletAddress={effectiveWallet}
          countryCode={defaultRecipient?.country ?? displayCountryCode}
          currencyCode={defaultRecipient?.currency ?? displayCurrency}
          recipientName={defaultRecipient?.name}
          onClose={() => setShowCashout(false)}
        />
      )}
      <Wm />
      <Hdr title="Done!" back={onBack} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingTop: 40, textAlign: "center" }}>
        <div style={{ fontSize: 64 }}>✅</div>

        {sendResult?.strategy === "timed" ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--purple)" }}>Deposited!</div>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>
              <strong style={{ color: "var(--text)" }}>${sendResult.amountUsdc} USDC</strong> is now earning{" "}
              <strong style={{ color: "var(--purple)" }}>{juicedApy}% APY</strong> in JUICED
            </div>
            <div style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-b)", borderRadius: 14, padding: "14px 18px", width: "100%" }}>
              <div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 6 }}>Releases to {defaultRecipient?.name} in</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--purple)" }}>{sendResult.holdDays} days</div>
              <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 6 }}>Maturity: {new Date(sendResult.matureAt).toLocaleDateString()}</div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                Est. yield: +${((sendResult.amountUsdc * juicedApy / 100) * (sendResult.holdDays / 365)).toFixed(4)} USDC
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>Sent!</div>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>
              <strong style={{ color: "var(--text)" }}>${sendAmount.toFixed(2)} USDC</strong> → <strong style={{ color: "var(--text)" }}>{defaultRecipient?.name}</strong>
            </div>
            {sendResult?.strategy === "instant_boost" && (
              <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-b)", borderRadius: 14, padding: "12px 18px", width: "100%" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 4 }}>⚡ Instant Boost used</div>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>Route: <span style={{ color: "var(--green)", fontWeight: 600 }}>{sendResult.route}</span></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", marginTop: 6 }}>Net gain: +${sendResult.netGainUsdc?.toFixed(4)} USDC</div>
              </div>
            )}
            <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-b)", borderRadius: 14, padding: "12px 18px", width: "100%" }}>
              <div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 4 }}>Recipient receives approx.</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--green)" }}>
                {countryData?.flag} {sym}{Math.round(sendAmount * fxRate).toLocaleString()} <span className="badge-est">est.</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 4 }}>via {defaultRecipient?.provider} · {currency}</div>
            </div>
          </>
        )}

        {txSigs.map(sig => (
          <a key={sig} href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: "var(--green)", fontFamily: "monospace" }}>View on Solscan ↗</a>
        ))}
        {effectiveWallet && (
          <button
            onClick={() => setShowCashout(true)}
            style={{
              width: "100%", padding: "13px 16px", borderRadius: 16,
              border: "1px solid var(--border2)", background: "var(--surface)",
              color: "var(--text)", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <span>💳</span> Help recipient cash out via Fonbnk →
          </button>
        )}
        <button className="btn-primary" style={{ maxWidth: 200 }} onClick={() => { setStep("amount"); setTxSigs([]); setSendResult(null); setShowCashout(false); }}>Send again</button>
        <button onClick={onBack} style={{ fontSize: 13, color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>← Back to home</button>
      </div>
    </div>
  );

  // ─── Review ─────────────────────────────────────────────────────────────────
  if (step === "review") {
    const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 12 };
    return (
      <div style={{ position: "relative", zIndex: 0 }}>
        <Wm />
        <Hdr title="Review Transfer" back={() => setStep("amount")} />
        <div style={{ padding: 16 }}>
          <div style={{ textAlign: "center", padding: "12px 0 16px" }}>
            <div className="num" style={{
              fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1,
              background: "linear-gradient(175deg, #DFFAA0 0%, #8FD520 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              display: "inline-block",
            }}>
              ${sendAmount.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", marginTop: 4 }}>USDC</div>
            {defaultRecipient && (
              <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span>{countryData?.flag}</span>
                <span>→ {defaultRecipient.name}</span>
                <span style={{ color: "var(--text3)" }}>·</span>
                <span>{defaultRecipient.provider}</span>
              </div>
            )}
          </div>

          {/* Fee breakdown */}
          <div style={{ ...card, padding: "12px 16px", marginBottom: 8 }}>
            {[
              { label: "Send amount",           val: `$${sendAmount.toFixed(2)}`,  color: "var(--text)" },
              { label: `Protocol fee (${PROTOCOL_FEE_BPS / 100}%)`, val: `-$${feeUsdc.toFixed(4)}`, color: "var(--amber)" },
              { label: "Recipient gets (USDC)", val: `$${netUsdc.toFixed(4)}`,  color: "var(--green)" },
            ].map(({ label, val, color }, i, arr) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: 11, color: "var(--text2)" }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
          </div>

          {/* FX row */}
          <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>Local equivalent (est.)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{sym}{Math.round(netUsdc * fxRate).toLocaleString()} <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>{currency}</span></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>Rate</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)" }}>1 USDC = {sym}{fxRate.toFixed(2)}</div>
            </div>
          </div>

          {/* Comparison */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>vs Competitors</div>
          <div style={card}>
            {([
              { n: "⚡ JupRemit", fee: "0.20%", amt: quote?.competitors?.jupremit?.localAmt ?? Math.round(netUsdc * fxRate), green: true },
              { n: "Brightwell",   fee: "$8.00",  amt: quote?.competitors?.brightwell?.localAmt  ?? Math.round((sendAmount - 8) * fxRate * 0.96),    green: false },
              { n: "MoneyGram",    fee: "$5.00",  amt: quote?.competitors?.moneygram?.localAmt   ?? Math.round((sendAmount - 5) * fxRate * 0.961),   green: false },
              { n: "Western Union",fee: "$6.99",  amt: quote?.competitors?.westernUnion?.localAmt ?? Math.round((sendAmount - 6.99) * fxRate * 0.957), green: false },
            ] as const).map((r, i) => (
              <div key={r.n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: r.green ? "var(--green)" : "var(--text2)" }}>{r.n}</span>
                <span style={{ fontSize: 11, color: r.green ? "var(--green)" : "var(--text3)" }}>{r.fee}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.green ? "var(--green)" : "var(--text2)" }}>
                  {sym}{r.amt.toLocaleString()} <span className="badge-est">est.</span>
                </span>
              </div>
            ))}
          </div>

          {tab === "instant" ? (
            <>
              <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 11, color: "var(--text2)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--text)" }}>⚡ Smart routing:</strong> checks if USDC→JupUSD→USDC gives more than a direct transfer after fees. <strong style={{ color: "var(--green)" }}>One wallet approval.</strong>
              </div>
              <button className="btn-primary" onClick={executeInstantSend} disabled={!effectiveWallet || !publicKey} style={{ marginBottom: 8 }}>
                ⚡ Send ${sendAmount.toFixed(2)} USDC instantly →
              </button>
            </>
          ) : (
            <>
              <div style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-b)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 11, color: "var(--text2)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--purple)" }}>🕐 Timed Send:</strong> Your USDC earns <strong style={{ color: "var(--purple)" }}>{juicedApy}% APY</strong> in JUICED for {holdDays} days, then releases to {defaultRecipient?.name} with yield.
              </div>
              <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                {[
                  ["Hold period", `${holdDays} days`],
                  ["APY", `${juicedApy}%`],
                  ["Est. yield", `+$${((sendAmount * juicedApy / 100) * (holdDays / 365)).toFixed(4)} USDC`],
                  ["Recipient gets", `~$${(sendAmount + (sendAmount * juicedApy / 100) * (holdDays / 365)).toFixed(4)} USDC`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <span style={{ color: "var(--text2)" }}>{k} <span className="badge-est">est.</span></span>
                    <span style={{ fontWeight: 700, color: "var(--purple)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <button className="btn-primary" style={{ background: "var(--purple)", color: "#fff", marginBottom: 8 }}
                onClick={executeTimedDeposit} disabled={!effectiveWallet || !publicKey}>
                🕐 Deposit ${sendAmount.toFixed(2)} into JUICED ({holdDays}d) →
              </button>
            </>
          )}
          <button onClick={() => setStep("amount")} style={{ width: "100%", background: "none", border: "none", color: "var(--text3)", fontSize: 13, cursor: "pointer", padding: 8, fontFamily: "inherit" }}>Cancel</button>
        </div>
      </div>
    );
  }

  // ─── Amount + Numpad (Jupiter-style) ─────────────────────────────────────────
  const activeSends   = timedSends.filter(t => t.status === "active");
  const releasedSends = timedSends.filter(t => t.status === "released").slice(0, 3);
  const accentColor   = tab === "instant" ? "var(--green)" : "var(--purple)";
  const accentBg      = tab === "instant" ? "var(--green-bg)" : "var(--purple-bg)";
  const accentBorder  = tab === "instant" ? "var(--green-b)" : "var(--purple-b)";

  return (
    <div style={{ position: "relative", zIndex: 0, display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {showScanner && (
        <QrScannerModal
          onResult={addr => setScannedWallet(addr)}
          onClose={() => setShowScanner(false)}
        />
      )}
      <Wm />
      <Hdr title="Send Money" back={onBack} action={
        <button onClick={() => setShowScanner(true)} style={{
          width: 36, height: 36, borderRadius: 12,
          border: "1px solid var(--green-b)", background: "var(--green-bg)",
          color: "var(--green)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer",
        }}>
          <ScanQrIcon />
        </button>
      } />

      <div style={{ padding: "12px 16px 0" }}>
        {/* Tab switcher */}
        <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 14, padding: 3, gap: 3, marginBottom: 12 }}>
          {([["instant", "⚡ Instant"], ["timed", "🕐 Timed"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "9px 8px", borderRadius: 11, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit",
              background: tab === t ? (t === "instant" ? "var(--green-bg)" : "var(--purple-bg)") : "transparent",
              color: tab === t ? (t === "instant" ? "var(--green)" : "var(--purple)") : "var(--text3)",
              transition: "background 0.15s, color 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {/* ── Country picker ── */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" as const, letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>
            Recipient Country
          </label>
          <div style={{ position: "relative" as const }}>
            <select
              value={displayCountryCode}
              onChange={e => setDisplayCountryCode(e.target.value)}
              style={{
                width: "100%", background: "var(--surface)",
                border: "1px solid var(--border2)", borderRadius: 14,
                padding: "13px 42px 13px 14px",
                fontSize: 15, fontWeight: 600, color: "var(--text)",
                appearance: "none" as any, WebkitAppearance: "none" as any,
                fontFamily: "inherit", cursor: "pointer", outline: "none",
              }}
            >
              {COUNTRIES.filter(c => c.code !== "OTHER").map(c => (
                <option key={c.code} value={c.code}>{c.flag}  {c.name} ({c.currency})</option>
              ))}
            </select>
            <svg style={{ position: "absolute" as const, right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" as const, color: "var(--text3)" }}
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Scanned wallet chip — shown when user scanned a QR */}
          {scannedWallet ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--green-bg)", border: "1px solid var(--green-b)", borderRadius: addressSaved || showSaveForm ? "10px 10px 0 0" : 10 }}>
                <span style={{ fontSize: 16 }}>🔍</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", marginBottom: 1 }}>Scanned wallet</div>
                  <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {scannedWallet}
                  </div>
                </div>
                {addressSaved ? (
                  <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>✅ Saved</span>
                ) : (
                  <button onClick={() => { setShowSaveForm(f => !f); setSaveName(""); }} style={{
                    fontSize: 11, fontWeight: 700, color: "var(--green)", background: "none",
                    border: "1px solid var(--green-b)", borderRadius: 8, cursor: "pointer",
                    padding: "4px 10px", fontFamily: "inherit",
                  }}>💾 Save</button>
                )}
                <button onClick={() => { setScannedWallet(null); setShowSaveForm(false); setAddressSaved(false); }} style={{
                  fontSize: 12, color: "var(--text3)", background: "none", border: "none",
                  cursor: "pointer", padding: "4px 6px", lineHeight: 1,
                }}>✕</button>
              </div>

              {/* Inline save form */}
              {showSaveForm && (
                <div style={{ padding: "12px 12px 14px", background: "var(--surface2)", border: "1px solid var(--green-b)", borderTop: "none", borderRadius: "0 0 10px 10px", display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  <input
                    value={saveName} onChange={e => setSaveName(e.target.value)}
                    placeholder="Name (e.g. Maria Santos)"
                    className="input-field" style={{ fontSize: 13 }}
                  />
                  <div style={{ position: "relative" as const }}>
                    <select value={saveCountryCode} onChange={e => { setSaveCountryCode(e.target.value); setSaveProvider(""); }} style={{
                      width: "100%", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10,
                      padding: "10px 36px 10px 12px", fontSize: 13, fontWeight: 600, color: "var(--text)",
                      appearance: "none" as any, WebkitAppearance: "none" as any, fontFamily: "inherit", cursor: "pointer", outline: "none",
                    }}>
                      {COUNTRIES.filter(c => c.code !== "OTHER").map(c => (
                        <option key={c.code} value={c.code}>{c.flag}  {c.name}</option>
                      ))}
                    </select>
                    <svg style={{ position: "absolute" as const, right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" as const, color: "var(--text3)" }}
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <button onClick={handleSaveAddress} disabled={!saveName.trim()} className="btn-primary" style={{ padding: "11px 16px", fontSize: 13 }}>
                    Save to address book →
                  </button>
                </div>
              )}
            </div>
          ) : defaultRecipient ? (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 10 }}>
              <span style={{ fontSize: 18 }}>{countryData?.flag ?? defaultRecipient.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{defaultRecipient.name}</span>
                <span style={{ fontSize: 11, color: accentColor, fontWeight: 600, marginLeft: 6 }}>· {defaultRecipient.provider}</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: accentColor }}>{displaySym}</span>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--amber-bg)", border: "1px solid var(--amber-b)", borderRadius: 10 }}>
              <span>⚠️</span>
              <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: 600 }}>Add a recipient in the Account tab to send</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Amount display — center stage ── */}
      <div style={{ padding: "8px 16px 0", textAlign: "center" }}>
        {(() => {
          const digits = input.replace(".", "").length;
          const numFs  = digits <= 3 ? 56 : digits <= 5 ? 46 : digits <= 7 ? 38 : 32;
          const dolFs  = Math.round(numFs * 0.46);
          return (
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
              <span style={{
                fontSize: dolFs, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1,
                color: sendAmount > 0 ? "rgba(220,250,130,0.45)" : "var(--text3)",
              }}>$</span>
              <span className="num" style={{
                fontSize: numFs, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em",
                ...(sendAmount > 0 ? {
                  background: "linear-gradient(175deg, #DFFAA0 0%, #8FD520 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                } : { color: "var(--text3)" }),
              }}>{input}</span>
            </div>
          );
        })()}
        <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", marginTop: 5 }}>USDC</div>
        {sendAmount > 0 && (
          <div style={{ fontSize: 14, color: "var(--text2)", marginTop: 8, fontWeight: 500 }}>
            ≈ {displaySym}{Math.round(sendAmount * fxRate).toLocaleString()}
            <span style={{ fontSize: 11, color: "var(--text3)", marginLeft: 4 }}>{displayCurrency}</span>
            &nbsp;<span className="badge-est">est.</span>
          </div>
        )}
      </div>

      {/* ── Hold days (Timed only) ── */}
      {tab === "timed" && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {([5, 15, 30] as const).map(d => (
              <button key={d} onClick={() => setHoldDays(d)} style={{
                flex: 1, padding: "10px 4px", borderRadius: 14, fontSize: 12, fontWeight: 700,
                border: `1px solid ${holdDays === d ? "var(--purple-b)" : "var(--border)"}`,
                background: holdDays === d ? "var(--purple-bg)" : "var(--surface)",
                color: holdDays === d ? "var(--purple)" : "var(--text2)",
                cursor: "pointer", fontFamily: "inherit", textAlign: "center" as const,
              }}>
                <div>{d}d</div>
                <div style={{ fontSize: 9, marginTop: 2, color: holdDays === d ? "var(--purple)" : "var(--text3)" }}>
                  +${((sendAmount * juicedApy / 100) * (d / 365)).toFixed(3)}
                </div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center", marginTop: 6 }}>
            Est. yield at {juicedApy}% APY <span className="badge-est">est.</span>
          </div>
        </div>
      )}

      {/* ── Numpad + percentage column ── */}
      <div style={{ padding: "16px 16px 12px", display: "flex", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, width: 56 }}>
          {([
            { label: "25%", pct: 0.25 },
            { label: "50%", pct: 0.50 },
            { label: "75%", pct: 0.75 },
            { label: "MAX", pct: 1.00 },
          ] as const).map(({ label, pct }) => {
            const val    = pctOfBalance(pct);
            const active = usdcBalance !== null && usdcBalance > 0 && Math.abs(sendAmount - val) < 0.01;
            const dim    = !usdcBalance || usdcBalance <= 0;
            return (
              <button key={label} onClick={() => !dim && setPreset(val)} style={{
                height: 64, borderRadius: 16, width: "100%",
                border: `1px solid ${active ? accentBorder : "var(--border)"}`,
                background: active ? accentBg : "var(--surface)",
                color: active ? accentColor : dim ? "var(--text3)" : "var(--text2)",
                cursor: dim ? "default" : "pointer", fontFamily: "inherit",
                fontSize: 11, fontWeight: 700,
                transition: "all 0.12s", opacity: dim ? 0.45 : 1,
                display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 2,
              }}>
                <span>{label}</span>
                {usdcBalance !== null && usdcBalance > 0 && (
                  <span style={{ fontSize: 8, color: active ? accentColor : "var(--text3)", fontWeight: 600 }}>
                    ${val.toFixed(0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }}>
          <Numpad value={input} onChange={handleNumpad} />
        </div>
      </div>

      {/* ── Review button ── */}
      <div style={{ padding: "0 16px 16px" }}>
        <button
          className="btn-primary"
          style={{ background: accentColor, color: tab === "instant" ? "var(--green-dk)" : "#fff" }}
          onClick={async () => { await fetchQuote(); setStep("review"); }}
          disabled={!effectiveWallet || sendAmount <= 0}
        >
          {loading ? "Loading…" : tab === "instant" ? `Review send $${input} →` : `Review ${holdDays}-day timed send →`}
        </button>
      </div>

      {/* ── Pending timed sends ── */}
      {activeSends.length > 0 && (
        <div style={{ padding: "0 16px 8px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Pending ({activeSends.length})
          </div>
          {activeSends.map(ts => {
            const msLeft  = ts.matureAt - now;
            const isReady = msLeft <= 0;
            const estYield = (ts.amountUsdc * juicedApy / 100) * (ts.holdDays / 365);
            return (
              <div key={ts.id} style={{
                background: isReady ? "var(--green-bg)" : "var(--surface)",
                border: `1px solid ${isReady ? "var(--green-b)" : "var(--border)"}`,
                borderRadius: 16, padding: 14, marginBottom: 10,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{ts.recipientFlag}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{ts.recipientName}</div>
                      <div style={{ fontSize: 10, color: "var(--text2)" }}>{ts.recipientProvider}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isReady ? "var(--green)" : "var(--purple)" }}>${ts.amountUsdc.toFixed(2)}</div>
                    <div style={{ fontSize: 9, color: "var(--text3)" }}>+${estYield.toFixed(4)} est.</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11, color: isReady ? "var(--green)" : "var(--text2)", fontWeight: isReady ? 700 : 400 }}>
                      {isReady ? "✅ Ready to release!" : msToCountdown(msLeft)}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text3)" }}>
                      {new Date(ts.depositedAt).toLocaleDateString()} · {ts.holdDays}d hold
                    </div>
                  </div>
                  {isReady ? (
                    <button
                      onClick={() => releaseTimedSend(ts.id)}
                      disabled={releasingId === ts.id}
                      style={{
                        fontSize: 11, fontWeight: 700, color: "var(--green-dk)",
                        background: "var(--green)", border: "none", borderRadius: 10,
                        padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
                        opacity: releasingId === ts.id ? 0.6 : 1,
                      }}>
                      {releasingId === ts.id ? "Releasing…" : "Release →"}
                    </button>
                  ) : (
                    <a href={`https://solscan.io/tx/${ts.depositTxSig}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 9, color: "var(--text3)", textDecoration: "none" }}>Solscan ↗</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Released history ── */}
      {releasedSends.length > 0 && (
        <div style={{ padding: "0 16px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Recently Released
          </div>
          {releasedSends.map(ts => (
            <div key={ts.id} style={{ background: "var(--surface2)", borderRadius: 14, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{ts.recipientFlag}</span>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text)" }}>{ts.recipientName}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>{new Date(ts.depositedAt).toLocaleDateString()} · {ts.holdDays}d</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>${ts.amountUsdc} + ${ts.yieldEarnedUsdc?.toFixed(4) ?? "0"} yield</div>
                <button onClick={() => removeTimedSend(ts.id)} style={{ fontSize: 9, color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
