"use client";
import { useState, useMemo } from "react";

const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRecipientStore, useTxHistoryStore, TxRecord } from "@/store/jupremit";

const COUNTRIES = [
  { flag: "🇵🇭", name: "Philippines", currency: "PHP", providers: ["Coins.ph", "GCash", "Maya"] },
  { flag: "🇮🇩", name: "Indonesia",   currency: "IDR", providers: ["GoPay", "OVO", "DANA"] },
  { flag: "🇻🇳", name: "Vietnam",     currency: "VND", providers: ["MoMo", "ZaloPay"] },
  { flag: "🇹🇭", name: "Thailand",    currency: "THB", providers: ["PromptPay", "TrueMoney"] },
  { flag: "🇲🇾", name: "Malaysia",    currency: "MYR", providers: ["Touch'n Go", "DuitNow"] },
  { flag: "🇸🇬", name: "Singapore",   currency: "SGD", providers: ["PayNow", "GrabPay"] },
  { flag: "🇿🇦", name: "South Africa", currency: "ZAR", providers: ["Standard Bank", "FNB", "Capitec"] },
  { flag: "🇺🇸", name: "USA",         currency: "USD", providers: ["ACH", "Venmo", "Zelle"] },
  { flag: "🇳🇬", name: "Nigeria",     currency: "NGN", providers: ["OPay", "Flutterwave"] },
  { flag: "🇰🇪", name: "Kenya",       currency: "KES", providers: ["M-Pesa"] },
  { flag: "🇮🇳", name: "India",       currency: "INR", providers: ["UPI", "PhonePe"] },
  { flag: "🇧🇷", name: "Brazil",      currency: "BRL", providers: ["Pix", "Nubank"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function dateLabel(ts: number): string {
  const d = new Date(ts).toDateString();
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  if (d === today)     return "Today";
  if (d === yesterday) return "Yesterday";
  return new Date(ts).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function groupByDate(txs: TxRecord[]): { label: string; items: TxRecord[] }[] {
  const map = new Map<string, TxRecord[]>();
  for (const tx of txs) {
    const key = new Date(tx.ts).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return Array.from(map.entries()).map(([key, items]) => ({
    label: dateLabel(items[0].ts),
    items,
  }));
}

type TxFilter = "all" | "instant_send" | "timed_deposit" | "timed_release";
type AStep    = "main" | "add" | "history" | "tx_detail";

// ─── Shared components ────────────────────────────────────────────────────────

const Wm = () => (
  <div aria-hidden style={{
    position: "absolute", inset: 0, zIndex: -1,
    opacity: 0.09, mixBlendMode: "screen" as const, pointerEvents: "none",
  }}>
    <Image src="/jupit-logo.png" alt="" fill sizes="390px"
      style={{ objectFit: "cover", objectPosition: "center" }} />
  </div>
);

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 36, height: 36, borderRadius: 12, border: "1px solid var(--border)",
      background: "var(--surface2)", display: "flex", alignItems: "center",
      justifyContent: "center", cursor: "pointer", color: "var(--text2)",
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Tx row card ──────────────────────────────────────────────────────────────

function TxRow({ tx, onSelect }: { tx: TxRecord; onSelect: (tx: TxRecord) => void }) {
  const isInstant  = tx.type === "instant_send";
  const isDeposit  = tx.type === "timed_deposit";
  const isRelease  = tx.type === "timed_release";
  const color  = isInstant ? "var(--green)" : isDeposit ? "var(--purple)" : "var(--teal)";
  const bg     = isInstant ? "var(--green-bg)" : isDeposit ? "var(--purple-bg)" : "var(--teal-bg)";
  const border = isInstant ? "var(--green-b)" : isDeposit ? "var(--purple-b)" : "var(--teal-b)";
  const icon   = isInstant ? "↗" : isDeposit ? "🔒" : "🔓";
  const label  = isInstant ? "Sent" : isDeposit ? "Deposited" : "Released";

  return (
    <button onClick={() => onSelect(tx)} style={{
      width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 16, padding: "12px 14px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      transition: "border-color 0.12s",
    }}
      onMouseOver={e => (e.currentTarget.style.borderColor = color)}
      onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 13, flexShrink: 0,
        background: bg, border: `1px solid ${border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>{icon}</div>

      {/* Middle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
          {tx.strategy === "instant_boost" && (
            <span style={{ fontSize: 8, fontWeight: 800, background: "var(--green-bg)", color: "var(--green)", padding: "1px 6px", borderRadius: 10, border: "1px solid var(--green-b)" }}>⚡ BOOST</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tx.toName ?? (tx.toWallet ? tx.toWallet.slice(0, 8) + "…" + tx.toWallet.slice(-4) : "—")}
        </div>
        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{timeAgo(tx.ts)}</div>
      </div>

      {/* Right */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color }}>${tx.amountUsdc.toFixed(2)}</div>
        {tx.feeUsdc > 0 && (
          <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 1 }}>fee ${tx.feeUsdc.toFixed(4)}</div>
        )}
        {tx.yieldUsdc !== undefined && tx.yieldUsdc > 0 && (
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", marginTop: 1 }}>+${tx.yieldUsdc.toFixed(4)}</div>
        )}
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AccountScreen() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { recipients, addRecipient, removeRecipient, setDefault } = useRecipientStore();
  const { txHistory, clearHistory } = useTxHistoryStore();

  const [step, setStep]                     = useState<AStep>("main");
  const [selectedCountryCode, setSelectedCountryCode] = useState(COUNTRIES[0].name);
  const [selectedProvider, setSelectedProvider]       = useState(COUNTRIES[0].providers[0]);
  const [name, setName]                     = useState("");
  const [wallet, setWallet]                 = useState("");
  const [saved, setSaved]                   = useState(false);
  const [txFilter, setTxFilter]             = useState<TxFilter>("all");
  const [selectedTx, setSelectedTx]         = useState<TxRecord | null>(null);
  const [confirmClear, setConfirmClear]     = useState(false);

  const selectedCountry = COUNTRIES.find(c => c.name === selectedCountryCode) ?? COUNTRIES[0];
  const addr  = publicKey?.toBase58() ?? "";
  const short = addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";

  const filteredTx = useMemo(() =>
    txFilter === "all" ? txHistory : txHistory.filter(t => t.type === txFilter),
    [txHistory, txFilter]
  );
  const grouped = useMemo(() => groupByDate(filteredTx), [filteredTx]);

  const totalSent    = txHistory.filter(t => t.type !== "timed_release").reduce((s, t) => s + t.amountUsdc, 0);
  const totalYield   = txHistory.reduce((s, t) => s + (t.yieldUsdc ?? 0), 0);
  const totalFees    = txHistory.reduce((s, t) => s + (t.feeUsdc ?? 0), 0);

  const handleAdd = () => {
    if (!name.trim() || !wallet.trim()) return;
    if (!SOL_PUBKEY_RE.test(wallet.trim())) {
      alert("Invalid Solana wallet address. Please check and try again.");
      return;
    }
    addRecipient({
      name: name.trim(),
      country: selectedCountry.name,
      currency: selectedCountry.currency,
      provider: selectedProvider,
      wallet: wallet.trim(),
      flag: selectedCountry.flag,
      isDefault: recipients.length === 0,
    });
    setName(""); setWallet(""); setSaved(true);
    setTimeout(() => { setSaved(false); setStep("main"); }, 1200);
  };

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: 16, marginBottom: 12,
  };

  // ── Tx detail ───────────────────────────────────────────────────────────────
  if (step === "tx_detail" && selectedTx) {
    const tx = selectedTx;
    const isInstant = tx.type === "instant_send";
    const isDeposit = tx.type === "timed_deposit";
    const color  = isInstant ? "var(--green)" : isDeposit ? "var(--purple)" : "var(--teal)";
    const bg     = isInstant ? "var(--green-bg)" : isDeposit ? "var(--purple-bg)" : "var(--teal-bg)";
    const border = isInstant ? "var(--green-b)" : isDeposit ? "var(--purple-b)" : "var(--teal-b)";
    const icon   = isInstant ? "↗" : isDeposit ? "🔒" : "🔓";
    const label  = isInstant ? "Sent" : isDeposit ? "Deposited" : "Released";

    return (
      <div style={{ position: "relative", zIndex: 0 }}>
        <Wm />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)", position: "sticky" as const, top: 0, zIndex: 10 }}>
          <BackBtn onClick={() => { setStep("history"); setSelectedTx(null); }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Transaction Detail</span>
          <div style={{ width: 36 }} />
        </div>
        <div style={{ padding: 20 }}>
          {/* Hero */}
          <div style={{ textAlign: "center", padding: "24px 0 20px" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: bg, border: `1px solid ${border}`, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>{icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
            <div className="num" style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color }}>
              ${tx.amountUsdc.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", marginTop: 4 }}>USDC</div>
          </div>

          {/* Detail rows */}
          <div style={card}>
            {[
              ["Date", fullDate(tx.ts)],
              ["Type", label + (tx.strategy === "instant_boost" ? " · ⚡ Instant Boost" : "")],
              ["Amount sent", `$${tx.amountUsdc.toFixed(2)} USDC`],
              tx.feeUsdc > 0 ? ["Protocol fee (0.20%)", `-$${tx.feeUsdc.toFixed(4)} USDC`] : null,
              tx.feeUsdc > 0 ? ["Net to recipient", `$${(tx.amountUsdc - tx.feeUsdc).toFixed(4)} USDC`] : null,
              tx.yieldUsdc !== undefined && tx.yieldUsdc > 0 ? ["Yield earned", `+$${tx.yieldUsdc.toFixed(4)} USDC`] : null,
              tx.toName ? ["Recipient", tx.toName] : null,
            ].filter(Boolean).map(([k, v], i, arr) => (
              <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", gap: 12 }}>
                <span style={{ fontSize: 11, color: "var(--text3)", flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", textAlign: "right", wordBreak: "break-all" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Wallet address */}
          {tx.toWallet && (
            <div style={{ ...card, wordBreak: "break-all" }}>
              <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 6, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Recipient Wallet</div>
              <div style={{ fontSize: 11, color: "var(--text2)", fontFamily: "monospace", lineHeight: 1.7 }}>{tx.toWallet}</div>
            </div>
          )}

          {/* Solscan link */}
          <a href={`https://solscan.io/tx/${tx.txSig}`} target="_blank" rel="noreferrer" style={{
            display: "block", textAlign: "center", padding: "14px", borderRadius: 14,
            background: "var(--surface2)", border: "1px solid var(--border)",
            fontSize: 13, fontWeight: 700, color: "var(--green)", textDecoration: "none",
          }}>
            View on Solscan ↗
          </a>
        </div>
      </div>
    );
  }

  // ── History screen ──────────────────────────────────────────────────────────
  if (step === "history") {
    const FILTERS: { key: TxFilter; label: string }[] = [
      { key: "all",           label: "All" },
      { key: "instant_send",  label: "Sent" },
      { key: "timed_deposit", label: "Deposited" },
      { key: "timed_release", label: "Released" },
    ];

    return (
      <div style={{ position: "relative", zIndex: 0 }}>
        <Wm />

        {/* Sticky header */}
        <div style={{ position: "sticky" as const, top: 0, zIndex: 10, background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 10px" }}>
            <BackBtn onClick={() => setStep("main")} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Transaction History</span>
            {txHistory.length > 0 ? (
              confirmClear ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { clearHistory(); setConfirmClear(false); }} style={{ fontSize: 10, fontWeight: 700, color: "var(--red)", background: "var(--red-bg)", border: "1px solid var(--red-b)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>Yes</button>
                  <button onClick={() => setConfirmClear(false)} style={{ fontSize: 10, color: "var(--text3)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} style={{ fontSize: 10, color: "var(--text3)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                  Clear
                </button>
              )
            ) : <div style={{ width: 52 }} />}
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", overflowX: "auto" as const }}>
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setTxFilter(f.key)} style={{
                padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: `1px solid ${txFilter === f.key ? "var(--green-b)" : "var(--border)"}`,
                background: txFilter === f.key ? "var(--green-bg)" : "var(--surface)",
                color: txFilter === f.key ? "var(--green)" : "var(--text3)",
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const,
                flexShrink: 0, transition: "all 0.12s",
              }}>{f.label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 16px 32px" }}>

          {/* Stats */}
          {txHistory.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Total sent", val: `$${totalSent.toFixed(2)}`, color: "var(--green)" },
                { label: "Yield earned", val: `$${totalYield.toFixed(4)}`, color: "var(--purple)" },
                { label: "Fees paid", val: `$${totalFees.toFixed(4)}`, color: "var(--amber)" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 3, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {filteredTx.length === 0 && (
            <div style={{ textAlign: "center", padding: "56px 24px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
                {txFilter === "all" ? "No transactions yet" : `No ${txFilter.replace("_", " ")} transactions`}
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>Your activity will appear here after your first send</div>
            </div>
          )}

          {/* Grouped list */}
          {grouped.map(group => (
            <div key={group.label}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8, marginTop: 4 }}>
                {group.label}
              </div>
              {group.items.map(tx => (
                <TxRow key={tx.id} tx={tx} onSelect={tx => { setSelectedTx(tx); setStep("tx_detail"); }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Add recipient ────────────────────────────────────────────────────────────
  if (step === "add") return (
    <div style={{ position: "relative", zIndex: 0 }}>
      <Wm />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)", position: "sticky" as const, top: 0, zIndex: 10 }}>
        <BackBtn onClick={() => setStep("main")} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Add Recipient</span>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: 16 }}>
        {saved && (
          <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-b)", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "var(--green)", marginBottom: 12, textAlign: "center" }}>
            ✅ Recipient saved!
          </div>
        )}

        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Name</div>
        <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="e.g. Maria Santos" style={{ marginBottom: 16 }} />

        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Country</div>
        <div style={{ position: "relative" as const, marginBottom: 16 }}>
          <select value={selectedCountryCode} onChange={e => { setSelectedCountryCode(e.target.value); setSelectedProvider(COUNTRIES.find(c => c.name === e.target.value)?.providers[0] ?? ""); }}
            style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 14, padding: "13px 42px 13px 14px", fontSize: 15, fontWeight: 600, color: "var(--text)", appearance: "none" as any, WebkitAppearance: "none" as any, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
            {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.flag}  {c.name} ({c.currency})</option>)}
          </select>
          <svg style={{ position: "absolute" as const, right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" as const, color: "var(--text3)" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Provider / App</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 16 }}>
          {selectedCountry.providers.map(p => (
            <button key={p} onClick={() => setSelectedProvider(p)} style={{
              padding: "8px 14px", borderRadius: 20, fontFamily: "inherit",
              border: `1px solid ${selectedProvider === p ? "var(--teal)" : "var(--border)"}`,
              background: selectedProvider === p ? "var(--teal-bg)" : "transparent",
              color: selectedProvider === p ? "var(--teal)" : "var(--text2)",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}>{p}</button>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Solana Wallet Address</div>
        <input value={wallet} onChange={e => setWallet(e.target.value)} className="input-field" placeholder="e.g. 7xKX…" style={{ marginBottom: 6, fontFamily: "monospace" }} />
        <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 16 }}>Recipient's Solana address or Coins.ph/GCash linked address</div>

        <button className="btn-primary" onClick={handleAdd} disabled={!name.trim() || !wallet.trim()}>
          Add recipient →
        </button>
      </div>
    </div>
  );

  // ── Main screen ──────────────────────────────────────────────────────────────
  const recentTx = txHistory.slice(0, 3);

  return (
    <div style={{ position: "relative", zIndex: 0 }}>
      <Wm />
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>Account</div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Wallet */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Wallet</div>
        {connected ? (
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--green-bg)", border: "1px solid var(--green-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👛</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{short}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "var(--green)" }}>Connected</span>
              </div>
            </div>
            <button onClick={() => disconnect()} style={{ fontSize: 10, color: "var(--text3)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
              Disconnect
            </button>
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12, textAlign: "center" }}>Connect your Phantom wallet to get started</div>
            <button className="btn-primary" onClick={() => setVisible(true)}>Connect Wallet</button>
          </div>
        )}

        {/* Recipients */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Recipients ({recipients.length})
          </div>
          <button onClick={() => setStep("add")} style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--green-b)", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            + Add
          </button>
        </div>

        {recipients.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "32px 16px" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>No recipients yet</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 16 }}>Add your family member's Solana wallet to start sending</div>
            <button className="btn-primary" style={{ maxWidth: 180, margin: "0 auto" }} onClick={() => setStep("add")}>Add recipient</button>
          </div>
        ) : (
          recipients.map(r => (
            <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--teal-bg)", border: "1px solid var(--teal-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{r.flag}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{r.name}</span>
                  {r.isDefault && <span style={{ fontSize: 8, fontWeight: 700, background: "var(--green-bg)", color: "var(--green)", padding: "1px 6px", borderRadius: 20, border: "1px solid var(--green-b)" }}>DEFAULT</span>}
                </div>
                <div style={{ fontSize: 10, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.provider} · {r.currency} · {r.wallet.slice(0, 12)}…
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!r.isDefault && (
                  <button onClick={() => setDefault(r.id)} style={{ fontSize: 9, color: "var(--text2)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>Default</button>
                )}
                <button onClick={() => removeRecipient(r.id)} style={{ fontSize: 9, color: "var(--red)", background: "none", border: "1px solid var(--red-b)", borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
              </div>
            </div>
          ))
        )}

        {/* Recent transactions — preview */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Recent Transactions
          </div>
          {txHistory.length > 0 && (
            <button onClick={() => setStep("history")} style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              View all ({txHistory.length}) →
            </button>
          )}
        </div>

        {recentTx.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "24px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>No transactions yet</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>Your send and vault activity will appear here</div>
          </div>
        ) : (
          <div style={{ marginBottom: 4 }}>
            {recentTx.map(tx => (
              <TxRow key={tx.id} tx={tx} onSelect={tx => { setSelectedTx(tx); setStep("tx_detail"); }} />
            ))}
            {txHistory.length > 3 && (
              <button onClick={() => setStep("history")} style={{
                width: "100%", padding: "11px", borderRadius: 14, fontSize: 12, fontWeight: 700,
                background: "var(--surface2)", border: "1px solid var(--border)",
                color: "var(--text2)", cursor: "pointer", fontFamily: "inherit", marginBottom: 8,
              }}>
                View all {txHistory.length} transactions →
              </button>
            )}
          </div>
        )}

        {/* Network info */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 4 }}>Network</div>
        <div style={{ ...card, background: "var(--surface2)" }}>
          {[
            ["Network", "Solana Mainnet"],
            ["Program", "EXjLoxj7…QUS"],
            ["Swap API", "Jupiter Ultra V2"],
            ["Lend API", "Jupiter Earn"],
            ["Protocol fee", "0.20% + gas"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, color: "var(--text2)" }}>{k}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: k === "Protocol fee" ? "var(--amber)" : "var(--text)", fontFamily: k === "Program" ? "monospace" : "inherit" }}>{v}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
