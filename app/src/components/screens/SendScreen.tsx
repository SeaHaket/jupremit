"use client";
import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useRecipientStore, useAppStore, useTimedSendStore } from "@/store/jupremit";

type Tab  = "instant" | "timed";
type Step = "amount" | "review" | "executing" | "success" | "error";

interface Props { onBack: () => void; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function msToCountdown(ms: number): string {
  if (ms <= 0) return "Ready to release";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SendScreen({ onBack }: Props) {
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const { defaultRecipient } = useRecipientStore();
  const { sendAmount, setSendAmount, holdDays, setHoldDays, juicedApy, setJuicedApy } = useAppStore();
  const { timedSends, addTimedSend, markReleased, markFailed, removeTimedSend } = useTimedSendStore();

  const [tab, setTab]             = useState<Tab>("instant");
  const [step, setStep]           = useState<Step>("amount");
  const [input, setInput]         = useState(sendAmount.toString());
  const [quote, setQuote]         = useState<any>(null);
  const [sendResult, setSendResult] = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [txSigs, setTxSigs]       = useState<string[]>([]);
  const [errMsg, setErrMsg]       = useState("");
  const [execStatus, setExecStatus] = useState("");
  const [fxRate, setFxRate]       = useState(61.16);
  const [now, setNow]             = useState(Date.now());
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const currency = defaultRecipient?.currency ?? "PHP";
  const sym      = currency === "PHP" ? "₱" : "$";

  useEffect(() => {
    fetch(`/api/fx?currency=${currency}`)
      .then(r => r.json()).then(d => setFxRate(d.rate ?? 61.16)).catch(() => {});
    fetch("/api/apy")
      .then(r => r.json()).then(d => setJuicedApy(d.apy ?? 4.5)).catch(() => {});
  }, [currency]);

  // Update countdown every minute
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

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
    const sig    = await connection.sendRawTransaction((signed as any).serialize(), { skipPreflight: false, maxRetries: 3 });
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  };

  /* ─── SPL direct USDC transfer ────────────────────────────────────────────── */
  const doDirectTransfer = async (fromPub: PublicKey, toPub: PublicKey, usdcRaw: number): Promise<string> => {
    const { createTransferInstruction, getAssociatedTokenAddress,
            createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID }
      = await import("@solana/spl-token");
    const USDC    = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const fromAta = await getAssociatedTokenAddress(USDC, fromPub);
    const toAta   = await getAssociatedTokenAddress(USDC, toPub);
    const tx      = new Transaction();
    if (!await connection.getAccountInfo(toAta))
      tx.add(createAssociatedTokenAccountInstruction(fromPub, toAta, toPub, USDC));
    tx.add(createTransferInstruction(fromAta, toAta, fromPub, BigInt(usdcRaw), [], TOKEN_PROGRAM_ID));
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPub;
    const signed = await signTransaction!(tx as any);
    const sig    = await connection.sendRawTransaction((signed as any).serialize());
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  };

  /* ─── INSTANT BOOST execution ─────────────────────────────────────────────── */
  const executeInstantSend = async () => {
    if (!publicKey || !signTransaction || !defaultRecipient) {
      setErrMsg("Wallet not connected or no recipient."); setStep("error"); return;
    }
    setStep("executing"); setErrMsg(""); setTxSigs([]);
    try {
      setExecStatus("Checking best route via Jupiter Ultra…");
      const res  = await fetch("/api/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderWallet: publicKey.toBase58(), recipientWallet: defaultRecipient.wallet, amountUsdc: sendAmount }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Route check failed");
      setSendResult(data);

      if (data.strategy === "instant_boost") {
        setExecStatus("Instant Boost active — approve in wallet…");
        const sig = await signAndSend(data.tx);
        setTxSigs([sig]);
      } else {
        setExecStatus("Sending USDC directly — approve in wallet…");
        const recipientPub = new PublicKey(defaultRecipient.wallet);
        const sig = await doDirectTransfer(publicKey, recipientPub, data.amountRaw);
        setTxSigs([sig]);
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
    if (!publicKey || !signTransaction || !defaultRecipient) {
      setErrMsg("Wallet not connected or no recipient."); setStep("error"); return;
    }
    setStep("executing"); setErrMsg(""); setTxSigs([]);
    try {
      setExecStatus(`Depositing $${sendAmount} USDC into JUICED (${holdDays}-day hold)…`);
      const res  = await fetch("/api/timed-send/deposit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderWallet: publicKey.toBase58(), amountUsdc: sendAmount }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Deposit failed");

      setExecStatus("Approve the Jupiter Lend deposit in your wallet…");
      const sig = await signAndSend(data.transaction);
      setTxSigs([sig]);

      // Save to localStorage
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
      // Step 1: Withdraw from JUICED back to sender
      const res  = await fetch("/api/timed-send/release", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderWallet:      publicKey.toBase58(),
          juicedAmountRaw:   ts.juicedAmountRaw,
          originalAmountRaw: Math.round(ts.amountUsdc * 1_000_000),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Withdraw failed");

      // Sign the withdraw tx (USDC comes back to sender)
      const withdrawSig = await signAndSend(data.transaction);

      // Step 2: Transfer to recipient (senderGetsRaw after fee)
      const recipientPub = new PublicKey(ts.recipientWallet);
      const transferSig  = await doDirectTransfer(publicKey, recipientPub, data.senderGetsRaw);

      markReleased(tsId, transferSig, data.yieldUsdc ?? 0);
    } catch (e: any) {
      console.error("Release failed:", e.message);
      markFailed(tsId);
      alert(`Release failed: ${e.message}`);
    }
    setReleasingId(null);
  };

  /* ─── Shared styles ─────────────────────────────────────────────────────────*/
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 12 };
  const Hdr = ({ title, back }: { title: string; back: () => void }) => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid var(--border)", background:"var(--bg)", position:"sticky" as const, top:0, zIndex:10 }}>
      <button onClick={back} style={{ width:32, height:32, borderRadius:10, border:"1px solid var(--border)", background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--text2)", fontSize:18 }}>←</button>
      <span style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{title}</span>
      <div style={{ width:32 }} />
    </div>
  );

  /* ─── Not connected ─────────────────────────────────────────────────────────*/
  if (!publicKey) return (
    <div>
      <Hdr title="Send Money" back={onBack} />
      <div style={{ padding:40, display:"flex", flexDirection:"column", alignItems:"center", gap:12, textAlign:"center" }}>
        <div style={{ fontSize:48 }}>↗</div>
        <div style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>Connect wallet to send</div>
        <button className="btn-primary" style={{ maxWidth:200 }} onClick={() => setVisible(true)}>Connect Wallet</button>
      </div>
    </div>
  );

  /* ─── Error ─────────────────────────────────────────────────────────────────*/
  if (step === "error") return (
    <div><Hdr title="Send Money" back={() => setStep("review")} />
      <div style={{ padding:24, textAlign:"center", paddingTop:48 }}>
        <div style={{ fontSize:56, marginBottom:12 }}>❌</div>
        <div style={{ fontSize:18, fontWeight:700, color:"var(--red)", marginBottom:12 }}>Failed</div>
        <div style={{ fontSize:12, color:"var(--text2)", background:"var(--red-bg)", border:"1px solid var(--red-b)", borderRadius:12, padding:"12px 16px", lineHeight:1.6, marginBottom:20 }}>{errMsg}</div>
        <button className="btn-primary" style={{ maxWidth:200, margin:"0 auto 10px" }} onClick={() => setStep("review")}>Try again</button><br />
        <button onClick={onBack} style={{ fontSize:13, color:"var(--text3)", background:"none", border:"none", cursor:"pointer", marginTop:8 }}>← Back</button>
      </div>
    </div>
  );

  /* ─── Executing ─────────────────────────────────────────────────────────────*/
  if (step === "executing") return (
    <div><Hdr title="Sending…" back={() => {}} />
      <div style={{ padding:24, display:"flex", flexDirection:"column", alignItems:"center", gap:16, paddingTop:64, textAlign:"center" }}>
        <div style={{ width:52, height:52, border:"3px solid var(--green)", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
        <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>Processing…</div>
        <div style={{ fontSize:13, color:"var(--text2)" }}>{execStatus}</div>
        <div style={{ background:"var(--amber-bg)", border:"1px solid var(--amber-b)", borderRadius:10, padding:"10px 16px", fontSize:12, color:"var(--amber)" }}>
          👛 Check your wallet — one approval needed
        </div>
      </div>
    </div>
  );

  /* ─── Success ───────────────────────────────────────────────────────────────*/
  if (step === "success") return (
    <div><Hdr title="Done!" back={onBack} />
      <div style={{ padding:24, display:"flex", flexDirection:"column", alignItems:"center", gap:14, paddingTop:40, textAlign:"center" }}>
        <div style={{ fontSize:64 }}>✅</div>

        {sendResult?.strategy === "timed" ? (
          <>
            <div style={{ fontSize:22, fontWeight:800, color:"var(--purple)" }}>Deposited!</div>
            <div style={{ fontSize:13, color:"var(--text2)" }}>
              <strong style={{ color:"var(--text)" }}>${sendResult.amountUsdc} USDC</strong> is now earning{" "}
              <strong style={{ color:"var(--purple)" }}>{juicedApy}% APY</strong> in JUICED
            </div>
            <div style={{ background:"var(--purple-bg)", border:"1px solid var(--purple-b)", borderRadius:14, padding:"14px 18px", width:"100%" }}>
              <div style={{ fontSize:10, color:"var(--text2)", marginBottom:6 }}>Releases to {defaultRecipient?.name} in</div>
              <div style={{ fontSize:22, fontWeight:800, color:"var(--purple)" }}>{sendResult.holdDays} days</div>
              <div style={{ fontSize:10, color:"var(--text2)", marginTop:6 }}>
                Maturity: {new Date(sendResult.matureAt).toLocaleDateString()}
              </div>
              <div style={{ fontSize:10, color:"var(--text3)", marginTop:4 }}>
                Est. yield: +${((sendResult.amountUsdc * juicedApy / 100) * (sendResult.holdDays / 365)).toFixed(4)} USDC
              </div>
            </div>
            <div style={{ fontSize:11, color:"var(--text3)", background:"var(--surface2)", borderRadius:10, padding:"8px 12px" }}>
              Come back in {sendResult.holdDays} days and tap "Release" to send to recipient with yield
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize:22, fontWeight:800, color:"var(--green)" }}>Sent!</div>
            <div style={{ fontSize:13, color:"var(--text2)" }}>
              <strong style={{ color:"var(--text)" }}>${sendAmount.toFixed(2)} USDC</strong> → <strong style={{ color:"var(--text)" }}>{defaultRecipient?.name}</strong>
            </div>
            {sendResult?.strategy === "instant_boost" ? (
              <div style={{ background:"var(--green-bg)", border:"1px solid var(--green-b)", borderRadius:14, padding:"12px 18px", width:"100%" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--green)", marginBottom:4 }}>⚡ Instant Boost used</div>
                <div style={{ fontSize:11, color:"var(--text2)" }}>Route: <span style={{ color:"var(--green)", fontWeight:600 }}>{sendResult.route}</span></div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--green)", marginTop:6 }}>Net gain: +${sendResult.netGainUsdc?.toFixed(4)} USDC</div>
              </div>
            ) : (
              <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:14, padding:"12px 18px", width:"100%" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", marginBottom:4 }}>↗ Direct route used</div>
                <div style={{ fontSize:11, color:"var(--text2)", lineHeight:1.6 }}>Boost wasn't profitable this time — direct transfer keeps your full amount intact.</div>
              </div>
            )}
            <div style={{ background:"var(--green-bg)", border:"1px solid var(--green-b)", borderRadius:14, padding:"12px 18px", width:"100%" }}>
              <div style={{ fontSize:10, color:"var(--green-d)", marginBottom:4 }}>Recipient receives approx.</div>
              <div style={{ fontSize:22, fontWeight:800, color:"var(--green)" }}>{sym}{Math.round(sendAmount * fxRate).toLocaleString()} <span className="badge-est">est.</span></div>
            </div>
          </>
        )}

        {txSigs.map(sig => (
          <a key={sig} href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer"
            style={{ fontSize:11, color:"var(--green)", fontFamily:"monospace" }}>View on Solscan ↗</a>
        ))}
        <button className="btn-primary" style={{ maxWidth:200 }} onClick={() => { setStep("amount"); setTxSigs([]); setSendResult(null); }}>Send again</button>
        <button onClick={onBack} style={{ fontSize:13, color:"var(--text3)", background:"none", border:"none", cursor:"pointer" }}>← Back to home</button>
      </div>
    </div>
  );

  /* ─── Review ────────────────────────────────────────────────────────────────*/
  if (step === "review") return (
    <div><Hdr title="Review Transfer" back={() => setStep("amount")} />
      <div style={{ padding:16 }}>
        <div style={{ textAlign:"center", padding:"12px 0 16px" }}>
          <div style={{ fontSize:28, fontWeight:800, color:"var(--text)" }}>${sendAmount.toFixed(2)} <span style={{ fontSize:16, color:"var(--text3)", fontWeight:500 }}>USDC</span></div>
          {defaultRecipient && <div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>→ {defaultRecipient.name} · {defaultRecipient.provider}</div>}
        </div>

        {/* Comparison */}
        <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>vs Competitors</div>
        <div style={card}>
          {([
            { n:"⚡ JupRemit", fee:"$0.003", amt: quote?.competitors?.jupremit?.localAmt ?? Math.round(sendAmount * fxRate), green:true },
            { n:"Brightwell",  fee:"$8.00",  amt: quote?.competitors?.brightwell?.localAmt  ?? Math.round((sendAmount-8)    * fxRate * 0.96),  green:false },
            { n:"MoneyGram",   fee:"$5.00",  amt: quote?.competitors?.moneygram?.localAmt   ?? Math.round((sendAmount-5)    * fxRate * 0.961), green:false },
            { n:"Western Union",fee:"$6.99", amt: quote?.competitors?.westernUnion?.localAmt ?? Math.round((sendAmount-6.99)* fxRate * 0.957), green:false },
          ] as const).map((r,i) => (
            <div key={r.n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom: i<3?"1px solid var(--border)":"none" }}>
              <span style={{ fontSize:12, fontWeight:600, color: r.green?"var(--green)":"var(--text2)" }}>{r.n}</span>
              <span style={{ fontSize:11, color: r.green?"var(--green)":"var(--text3)" }}>{r.fee}</span>
              <span style={{ fontSize:12, fontWeight:700, color: r.green?"var(--green)":"var(--text2)" }}>{sym}{r.amt.toLocaleString()} <span className="badge-est">est.</span></span>
            </div>
          ))}
        </div>

        {tab === "instant" ? (
          <>
            <div style={{ background:"var(--surface2)", borderRadius:12, padding:"12px 14px", marginBottom:16, fontSize:11, color:"var(--text2)", lineHeight:1.7 }}>
              <strong style={{ color:"var(--text)" }}>⚡ Smart routing:</strong> We check if USDC→JupUSD→USDC gives more than direct transfer after fees. Best route wins. <strong style={{ color:"var(--green)" }}>One wallet approval.</strong>
            </div>
            {defaultRecipient && (
              <div style={{ ...card, background:"var(--green-bg)", border:"1px solid var(--green-b)", display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                <span style={{ fontSize:24 }}>{defaultRecipient.flag}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{defaultRecipient.name}</div>
                  <div style={{ fontSize:9, color:"var(--text2)", fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{defaultRecipient.wallet}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--green)" }}>${sendAmount.toFixed(2)}</div>
                  <div style={{ fontSize:10, color:"var(--text2)" }}>USDC</div>
                </div>
              </div>
            )}
            <button className="btn-primary" onClick={executeInstantSend} disabled={!defaultRecipient || !publicKey} style={{ marginBottom:8 }}>
              ⚡ Send ${sendAmount} USDC instantly →
            </button>
          </>
        ) : (
          <>
            <div style={{ background:"var(--purple-bg)", border:"1px solid var(--purple-b)", borderRadius:12, padding:"12px 14px", marginBottom:12, fontSize:11, color:"var(--text2)", lineHeight:1.7 }}>
              <strong style={{ color:"var(--purple)" }}>🕐 Timed Send:</strong> Your USDC goes into JUICED (Jupiter Lend) earning <strong style={{ color:"var(--purple)" }}>{juicedApy}% APY</strong> for {holdDays} days. After {holdDays} days you release it to {defaultRecipient?.name} with yield included. <strong style={{ color:"var(--text)" }}>One wallet approval now.</strong>
            </div>
            <div style={{ background:"var(--surface2)", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
              {[
                ["Hold period", `${holdDays} days`],
                ["APY", `${juicedApy}%`],
                ["Est. yield", `+$${((sendAmount * juicedApy / 100) * (holdDays / 365)).toFixed(4)} USDC`],
                ["Recipient gets", `~$${(sendAmount + (sendAmount * juicedApy / 100) * (holdDays / 365)).toFixed(4)} USDC`],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid var(--border)", fontSize:12 }}>
                  <span style={{ color:"var(--text2)" }}>{k} <span className="badge-est">est.</span></span>
                  <span style={{ fontWeight:700, color:"var(--purple)" }}>{v}</span>
                </div>
              ))}
            </div>
            {defaultRecipient && (
              <div style={{ ...card, background:"var(--purple-bg)", border:"1px solid var(--purple-b)", display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                <span style={{ fontSize:24 }}>{defaultRecipient.flag}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{defaultRecipient.name}</div>
                  <div style={{ fontSize:9, color:"var(--text2)", fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{defaultRecipient.wallet}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:11, color:"var(--purple)", fontWeight:700 }}>Releases in {holdDays}d</div>
                  <div style={{ fontSize:10, color:"var(--text2)" }}>{new Date(Date.now() + holdDays * 86_400_000).toLocaleDateString()}</div>
                </div>
              </div>
            )}
            <button className="btn-primary" style={{ background:"var(--purple)", color:"#fff", marginBottom:8 }}
              onClick={executeTimedDeposit} disabled={!defaultRecipient || !publicKey}>
              🕐 Deposit ${sendAmount} into JUICED ({holdDays}d) →
            </button>
          </>
        )}
        <button onClick={() => setStep("amount")} style={{ width:"100%", background:"none", border:"none", color:"var(--text3)", fontSize:13, cursor:"pointer", padding:8, fontFamily:"inherit" }}>Cancel</button>
      </div>
    </div>
  );

  /* ─── Amount + Pending timed sends ──────────────────────────────────────────*/
  const activeSends   = timedSends.filter(t => t.status === "active");
  const releasedSends = timedSends.filter(t => t.status === "released").slice(0, 3);

  return (
    <div>
      <Hdr title="Send Money" back={onBack} />
      <div style={{ padding:16 }}>

        {/* Tab switcher */}
        <div style={{ display:"flex", background:"var(--surface2)", borderRadius:14, padding:3, marginBottom:16, gap:3 }}>
          {([["instant","⚡ Instant"],["timed","🕐 Timed Send"]] as const).map(([t,label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex:1, padding:"9px 8px", borderRadius:11, fontSize:12, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"inherit",
                background: tab===t ? (t==="instant"?"var(--green-bg)":"var(--purple-bg)") : "transparent",
                color: tab===t ? (t==="instant"?"var(--green)":"var(--purple)") : "var(--text3)" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Recipient */}
        {defaultRecipient ? (
          <div style={{ ...card, display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:28 }}>{defaultRecipient.flag}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{defaultRecipient.name}</div>
              <div style={{ fontSize:10, color:"var(--text2)" }}>{defaultRecipient.provider} · {defaultRecipient.currency}</div>
            </div>
            <span className="badge badge-green">Default</span>
          </div>
        ) : (
          <div style={{ ...card, textAlign:"center", color:"var(--amber)", padding:"16px" }}>⚠️ No recipient — go to Account tab first</div>
        )}

        {/* Amount input */}
        <div style={card}>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Amount (USDC)</div>
          <div style={{ display:"flex", alignItems:"center", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px", marginBottom:8 }}>
            <span style={{ fontSize:20, fontWeight:700, color:"var(--text2)", marginRight:6 }}>$</span>
            <input type="number" value={input} min="1"
              onChange={e => { setInput(e.target.value); const n=parseFloat(e.target.value); if(!isNaN(n)&&n>0) setSendAmount(n); }}
              style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:24, fontWeight:700, color:"var(--text)", fontFamily:"inherit" }}
              placeholder="100" />
          </div>
          <div style={{ fontSize:12, color:"var(--text2)", textAlign:"right", marginBottom:12 }}>
            ≈ {sym}{Math.round(sendAmount * fxRate).toLocaleString()} {currency} <span className="badge-est">est.</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[1,5,10,50].map(a => (
              <button key={a} onClick={() => { setInput(a.toString()); setSendAmount(a); }}
                style={{ flex:1, padding:"10px 4px", borderRadius:10, fontSize:12, fontWeight:700,
                  border:`1px solid ${sendAmount===a?(tab==="instant"?"var(--green)":"var(--purple)"):"var(--border)"}`,
                  background:sendAmount===a?(tab==="instant"?"var(--green-bg)":"var(--purple-bg)"):"transparent",
                  color:sendAmount===a?(tab==="instant"?"var(--green)":"var(--purple)"):"var(--text2)",
                  cursor:"pointer", fontFamily:"inherit" }}>
                ${a}
              </button>
            ))}
          </div>
        </div>

        {/* Timed: hold days picker */}
        {tab === "timed" && (
          <div style={card}>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Hold duration</div>
            <div style={{ display:"flex", gap:8 }}>
              {([5,15,30] as const).map(d => (
                <button key={d} onClick={() => setHoldDays(d)}
                  style={{ flex:1, padding:"12px 4px", borderRadius:12, fontSize:13, fontWeight:700,
                    border:`1px solid ${holdDays===d?"var(--purple)":"var(--border)"}`,
                    background:holdDays===d?"var(--purple-bg)":"transparent",
                    color:holdDays===d?"var(--purple)":"var(--text2)",
                    cursor:"pointer", fontFamily:"inherit", textAlign:"center" as const }}>
                  <div>{d} days</div>
                  <div style={{ fontSize:9, marginTop:2, color:holdDays===d?"var(--purple)":"var(--text3)" }}>
                    +${((sendAmount * juicedApy / 100) * (d / 365)).toFixed(3)}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ fontSize:10, color:"var(--text3)", textAlign:"center", marginTop:8 }}>
              Est. yield at {juicedApy}% APY <span className="badge-est">est.</span>
            </div>
          </div>
        )}

        {/* Instant: smart routing info */}
        {tab === "instant" && (
          <div style={{ background:"var(--green-bg)", border:"1px solid var(--green-b)", borderRadius:12, padding:"10px 14px", marginBottom:12, fontSize:11, color:"var(--text2)", lineHeight:1.7 }}>
            <span style={{ fontWeight:700, color:"var(--green)" }}>⚡ Smart routing</span> — checks if boosting via JupUSD is profitable after fees. Always picks the best outcome. <strong style={{ color:"var(--text)" }}>One approval, always protected.</strong>
          </div>
        )}

        <button className="btn-primary"
          style={{ background: tab==="timed"?"var(--purple)":"var(--green)", color: tab==="timed"?"#fff":"var(--green-dk)", marginBottom:16 }}
          onClick={async () => { await fetchQuote(); setStep("review"); }}
          disabled={!defaultRecipient || sendAmount<=0}>
          {loading ? "Loading…" : tab==="instant" ? `Review instant send →` : `Review ${holdDays}-day timed send →`}
        </button>

        {/* ── Pending timed sends ── */}
        {activeSends.length > 0 && (
          <>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
              Pending Timed Sends ({activeSends.length})
            </div>
            {activeSends.map(ts => {
              const msLeft  = ts.matureAt - now;
              const isReady = msLeft <= 0;
              const estYield = (ts.amountUsdc * juicedApy / 100) * (ts.holdDays / 365);
              return (
                <div key={ts.id} style={{ ...card, background: isReady?"var(--green-bg)":"var(--surface)", border:`1px solid ${isReady?"var(--green-b)":"var(--border)"}` }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:20 }}>{ts.recipientFlag}</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:"var(--text)" }}>{ts.recipientName}</div>
                        <div style={{ fontSize:10, color:"var(--text2)" }}>{ts.recipientProvider}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13, fontWeight:700, color: isReady?"var(--green)":"var(--purple)" }}>
                        ${ts.amountUsdc.toFixed(2)}
                      </div>
                      <div style={{ fontSize:9, color:"var(--text3)" }}>+${estYield.toFixed(4)} est.</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:11, color: isReady?"var(--green)":"var(--text2)", fontWeight: isReady?700:400 }}>
                        {isReady ? "✅ Ready to release!" : msToCountdown(msLeft)}
                      </div>
                      <div style={{ fontSize:9, color:"var(--text3)" }}>
                        Deposited {new Date(ts.depositedAt).toLocaleDateString()} · {ts.holdDays}d hold
                      </div>
                    </div>
                    {isReady ? (
                      <button
                        onClick={() => releaseTimedSend(ts.id)}
                        disabled={releasingId === ts.id}
                        style={{ fontSize:11, fontWeight:700, color:"var(--green-dk)", background:"var(--green)", border:"none", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontFamily:"inherit", opacity: releasingId===ts.id?0.6:1 }}>
                        {releasingId===ts.id ? "Releasing…" : "Release →"}
                      </button>
                    ) : (
                      <a href={`https://solscan.io/tx/${ts.depositTxSig}`} target="_blank" rel="noreferrer"
                        style={{ fontSize:9, color:"var(--text3)", textDecoration:"none" }}>Solscan ↗</a>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── Released history ── */}
        {releasedSends.length > 0 && (
          <>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8, marginTop:4 }}>
              Recently Released
            </div>
            {releasedSends.map(ts => (
              <div key={ts.id} style={{ ...card, background:"var(--surface2)", opacity:0.8 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:18 }}>{ts.recipientFlag}</span>
                    <div>
                      <div style={{ fontSize:12, color:"var(--text)" }}>{ts.recipientName}</div>
                      <div style={{ fontSize:10, color:"var(--text3)" }}>{new Date(ts.depositedAt).toLocaleDateString()} · {ts.holdDays}d</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--green)" }}>${ts.amountUsdc} + ${ts.yieldEarnedUsdc?.toFixed(4) ?? "0"} yield</div>
                    <button onClick={() => removeTimedSend(ts.id)} style={{ fontSize:9, color:"var(--text3)", background:"none", border:"none", cursor:"pointer" }}>Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

      </div>
    </div>
  );
}
