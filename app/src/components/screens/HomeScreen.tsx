"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRecipientStore } from "@/store/jupremit";

const Wm = () => (
  <div aria-hidden style={{
    position: "absolute", inset: 0, zIndex: -1,
    opacity: 0.09, mixBlendMode: "screen" as const, pointerEvents: "none",
  }}>
    <Image src="/jupit-logo.png" alt="" fill sizes="390px"
      style={{ objectFit: "cover", objectPosition: "center" }} />
  </div>
);

// ─── Logo with fallback chain ─────────────────────────────────────────────────
const LOGO_SRCS = ["/logo.svg", "/logo.png", "/logo.jpg", "/logo.jpeg", "/logo.webp"];

function AppLogo({ style }: { style?: React.CSSProperties }) {
  const [idx, setIdx] = useState(0);
  if (idx >= LOGO_SRCS.length) {
    return (
      <div style={{
        ...style,
        background: "linear-gradient(135deg, #0E1C36 0%, #1B3F8A 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: Number(style?.width ?? 60) * 0.42,
        color: "#C7F284", letterSpacing: "-0.02em",
      }}>J</div>
    );
  }
  return (
    <img src={LOGO_SRCS[idx]} alt="JupRemit" style={style} onError={() => setIdx(i => i + 1)} />
  );
}

// ─── Country data ─────────────────────────────────────────────────────────────
interface CountryData {
  flag: string;
  name: string;
  short: string;
  currency: string;
  symbol: string;
  fallbackRate: number;
  competitors: { name: string; fee: number; markup: number }[];
}

// markup = how far below mid-market competitor's rate is (verified from real apps)
// fee = flat fee charged ON TOP of the send amount (sender pays sendAmt + fee)
// recipient gets: sendAmt * midRate * (1 - markup)
const COUNTRIES: CountryData[] = [
  { flag: "🇵🇭", name: "Philippines", short: "PH", currency: "PHP", symbol: "₱",   fallbackRate: 61.16,
    // Real rates verified May 2025: WU 1USD=60.2086 fee $8, MG 1USD=60.14 fee $5, Brightwell 1USD=60.12 fee $6.99
    competitors: [{ name: "Western Union", fee: 8.00, markup: 0.0156 }, { name: "MoneyGram", fee: 5.00, markup: 0.0167 }, { name: "Brightwell",   fee: 6.99, markup: 0.0170 }] },
  { flag: "🇮🇩", name: "Indonesia",   short: "ID", currency: "IDR", symbol: "Rp",  fallbackRate: 16350,
    competitors: [{ name: "Western Union", fee: 4.99, markup: 0.019 }, { name: "MoneyGram", fee: 4.49, markup: 0.018 }, { name: "Remitly",      fee: 3.49, markup: 0.011 }] },
  { flag: "🇻🇳", name: "Vietnam",     short: "VN", currency: "VND", symbol: "₫",   fallbackRate: 25400,
    competitors: [{ name: "Western Union", fee: 4.99, markup: 0.018 }, { name: "MoneyGram", fee: 4.49, markup: 0.017 }, { name: "Remitly",      fee: 3.49, markup: 0.013 }] },
  { flag: "🇹🇭", name: "Thailand",    short: "TH", currency: "THB", symbol: "฿",   fallbackRate: 34.2,
    competitors: [{ name: "Western Union", fee: 4.99, markup: 0.018 }, { name: "MoneyGram", fee: 4.49, markup: 0.017 }, { name: "Remitly",      fee: 3.49, markup: 0.012 }] },
  { flag: "🇲🇾", name: "Malaysia",    short: "MY", currency: "MYR", symbol: "RM",  fallbackRate: 4.48,
    competitors: [{ name: "Western Union", fee: 4.99, markup: 0.016 }, { name: "MoneyGram", fee: 4.49, markup: 0.015 }, { name: "Wise",         fee: 1.49, markup: 0.005 }] },
  { flag: "🇸🇬", name: "Singapore",   short: "SG", currency: "SGD", symbol: "S$",  fallbackRate: 1.34,
    competitors: [{ name: "Western Union", fee: 4.99, markup: 0.015 }, { name: "MoneyGram", fee: 4.49, markup: 0.014 }, { name: "Wise",         fee: 1.49, markup: 0.004 }] },
  { flag: "🇿🇦", name: "South Africa", short: "ZA", currency: "ZAR", symbol: "R",   fallbackRate: 18.5,
    competitors: [{ name: "Western Union", fee: 5.99, markup: 0.022 }, { name: "MoneyGram", fee: 5.49, markup: 0.020 }, { name: "Remitly",      fee: 3.99, markup: 0.015 }] },
  { flag: "🇺🇸", name: "USA",         short: "US", currency: "USD", symbol: "$",   fallbackRate: 1.0,
    competitors: [{ name: "Western Union", fee: 4.99, markup: 0.005 }, { name: "MoneyGram", fee: 3.99, markup: 0.003 }, { name: "Wise",         fee: 0.99, markup: 0.001 }] },
  { flag: "🇳🇬", name: "Nigeria",     short: "NG", currency: "NGN", symbol: "₦",   fallbackRate: 1620,
    competitors: [{ name: "Western Union", fee: 5.99, markup: 0.025 }, { name: "MoneyGram", fee: 5.49, markup: 0.024 }, { name: "Remitly",      fee: 3.99, markup: 0.018 }] },
  { flag: "🇰🇪", name: "Kenya",       short: "KE", currency: "KES", symbol: "KSh", fallbackRate: 129,
    competitors: [{ name: "Western Union", fee: 5.99, markup: 0.023 }, { name: "MoneyGram", fee: 5.49, markup: 0.022 }, { name: "Remitly",      fee: 3.99, markup: 0.016 }] },
  { flag: "🇮🇳", name: "India",       short: "IN", currency: "INR", symbol: "₹",   fallbackRate: 83.4,
    competitors: [{ name: "Western Union", fee: 4.99, markup: 0.014 }, { name: "MoneyGram", fee: 4.99, markup: 0.015 }, { name: "Wise",         fee: 1.99, markup: 0.005 }] },
  { flag: "🇧🇷", name: "Brazil",      short: "BR", currency: "BRL", symbol: "R$",  fallbackRate: 5.2,
    competitors: [{ name: "Western Union", fee: 4.99, markup: 0.017 }, { name: "MoneyGram", fee: 4.49, markup: 0.016 }, { name: "Wise",         fee: 1.49, markup: 0.005 }] },
];

// ─── Icons ────────────────────────────────────────────────────────────────────
function SendIcon({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill={color} />
    </svg>
  );
}

function VaultIcon({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" fill={color} fillOpacity="0.15" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1.5" fill={color} />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { onSend: () => void; onVault: () => void; }

export default function HomeScreen({ onSend, onVault }: Props) {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { defaultRecipient } = useRecipientStore();

  const [apy, setApy]                   = useState(4.5);
  const [usdc, setUsdc]                 = useState(0);
  const [sol, setSol]                   = useState(0);
  const [loading, setLoading]           = useState(false);
  const [selectedShort, setSelectedShort] = useState("PH");
  const [fxRate, setFxRate]             = useState<number | null>(null);

  const country = COUNTRIES.find(c => c.short === selectedShort) ?? COUNTRIES[0];

  // APY — fetch once
  useEffect(() => {
    fetch("/api/apy").then(r => r.json()).then(d => setApy(d.apy ?? 4.5)).catch(() => {});
  }, []);

  // Live FX — refetch when country changes
  useEffect(() => {
    setFxRate(null);
    fetch(`/api/fx?currency=${country.currency}`)
      .then(r => r.json()).then(d => setFxRate(d.rate ?? null)).catch(() => {});
  }, [country.currency]);

  // Balance — refetch on wallet change
  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    fetch(`/api/balance?wallet=${publicKey.toBase58()}&network=mainnet-beta`)
      .then(r => r.json())
      .then(d => { setUsdc(d.usdc ?? 0); setSol(d.sol ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [publicKey]);

  const refreshAll = useCallback(() => {
    fetch("/api/apy").then(r => r.json()).then(d => setApy(d.apy ?? 4.5)).catch(() => {});
    fetch(`/api/fx?currency=${country.currency}`)
      .then(r => r.json()).then(d => setFxRate(d.rate ?? null)).catch(() => {});
    if (publicKey) {
      setLoading(true);
      fetch(`/api/balance?wallet=${publicKey.toBase58()}&network=mainnet-beta`)
        .then(r => r.json())
        .then(d => { setUsdc(d.usdc ?? 0); setSol(d.sol ?? 0); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [publicKey, country.currency]);

  const addr  = publicKey?.toBase58() ?? "";
  const short = addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";

  // ─── Competitor calc ($100 send) ───────────────────────────────────────────
  // Correct model (verified vs real apps):
  //   Sender pays:    $100 + fee  (fee charged ON TOP of send amount)
  //   Recipient gets: 100 * midRate * (1 - markup)  (exchange rate marked down)
  // Total local-currency savings = rate gap + fee equivalent in local currency
  const rate       = fxRate ?? country.fallbackRate;
  const pasapayAmt = Math.round(100 * rate);
  const compRows = country.competitors.map(c => {
    const theirAmt   = Math.round(100 * rate * (1 - c.markup));
    const rateGain   = pasapayAmt - theirAmt;
    const feeInLocal = Math.round(c.fee * rate);
    const totalSave  = rateGain + feeInLocal;            // total local-currency advantage
    return {
      name:        c.name,
      fee:         c.fee,
      youPay:      `$${(100 + c.fee).toFixed(2)}`,
      feeLabel:    `+$${c.fee.toFixed(2)} fee`,
      amt:         theirAmt,
      rateGain,
      feeInLocal,
      totalSave,
    };
  });
  const refComp  = country.competitors[0];
  const feeSaved = refComp.fee.toFixed(2);

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 20, padding: 16, marginBottom: 12,
  };

  // ─── Splash / not connected ────────────────────────────────────────────────
  if (!connected) return (
    <div style={{ position: "relative", zIndex: 0, overflow: "hidden", padding: "32px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "82vh", gap: 14, textAlign: "center" }}>
      <Wm />
      <AppLogo style={{ width: 104, height: 104, borderRadius: 28, marginBottom: 2, boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }} />
      <div className="grad-green" style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>JupRemit</div>
      <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginTop: -6 }}>
        Global DeFi Remittance
      </div>
      <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.75, maxWidth: 280, fontWeight: 500 }}>
        Send money anywhere in the world for almost <strong style={{ color: "var(--green)" }}>free</strong>.<br />
        Mid-market rates · <strong style={{ color: "var(--green)" }}>{apy}% APY</strong> on funds in transit.
      </div>

      <button className="btn-primary" style={{ maxWidth: 280, marginTop: 2 }} onClick={() => setVisible(true)}>
        Connect Wallet to Start
      </button>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {["Ultra Swap", "Jupiter Lend", "JupCard", "Solana", "12+ Countries"].map(n => (
          <span key={n} style={{ fontSize: 9, fontWeight: 700, background: "var(--surface2)", color: "var(--green)", padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)" }}>{n}</span>
        ))}
      </div>
    </div>
  );

  // ─── Connected home ────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", zIndex: 0, paddingBottom: 32 }}>
      <Wm />

      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AppLogo style={{ width: 30, height: 30, borderRadius: 9 }} />
          <span style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em" }}>JupRemit</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "4px 10px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text2)", fontFamily: "monospace" }}>{short}</span>
          </div>
          <button onClick={() => disconnect()} style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            Disconnect
          </button>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>

        {/* Balance card */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 14 }}>Wallet Balance</div>
          <div style={{ textAlign: "center", paddingBottom: 4 }}>
            {loading ? (
              <>
                <div className="skeleton" style={{ height: 52, width: 180, margin: "0 auto 8px" }} />
                <div className="skeleton" style={{ height: 16, width: 120, margin: "0 auto" }} />
              </>
            ) : (
              <>
                <div className="num grad-green" style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em" }}>
                  {usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.08em", marginTop: 5 }}>USDC</div>
                {sol > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 5 }}>{sol.toFixed(4)} SOL for gas</div>
                )}
              </>
            )}
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "14px 0 10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="live-dot" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)" }}>Earning in JUICED</span>
            </div>
            <span className="num" style={{ fontSize: 13, fontWeight: 800, color: "var(--green)" }}>{apy}% APY</span>
          </div>
        </div>

        {/* Action tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <button onClick={onSend} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: "18px 16px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10,
            fontFamily: "inherit", transition: "border-color 0.15s",
          }}
            onMouseOver={e => (e.currentTarget.style.borderColor = "var(--green)")}
            onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div style={{ width: 42, height: 42, borderRadius: 13, background: "var(--green-bg)", border: "1px solid var(--green-b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SendIcon size={20} color="var(--green)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 3 }}>Send</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)" }}>$0 fee · instant</div>
            </div>
          </button>
          <button onClick={onVault} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: "18px 16px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10,
            fontFamily: "inherit", transition: "border-color 0.15s",
          }}
            onMouseOver={e => (e.currentTarget.style.borderColor = "var(--purple)")}
            onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div style={{ width: 42, height: 42, borderRadius: 13, background: "var(--purple-bg)", border: "1px solid var(--purple-b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <VaultIcon size={20} color="var(--purple)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 3 }}>Vault</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)" }}>{apy}% APY · 1–5 months</div>
            </div>
          </button>
        </div>

        {/* Country dropdown */}
        <div style={{ marginBottom: 12 }}>
          <div className="label-xs">Recipient Country</div>
          <div style={{ position: "relative" as const }}>
            <select
              value={selectedShort}
              onChange={e => setSelectedShort(e.target.value)}
              style={{
                width: "100%", background: "var(--surface)",
                border: "1px solid var(--border2)", borderRadius: 14,
                padding: "13px 42px 13px 14px",
                fontSize: 15, fontWeight: 600, color: "var(--text)",
                appearance: "none" as any, WebkitAppearance: "none" as any,
                fontFamily: "inherit", cursor: "pointer", outline: "none",
              }}
            >
              {COUNTRIES.map(c => (
                <option key={c.short} value={c.short}>{c.flag}  {c.name} ({c.currency})</option>
              ))}
            </select>
            <svg style={{ position: "absolute" as const, right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" as const, color: "var(--text3)" }}
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Competitor comparison */}
        <div className="label-xs">
          Sending $100 → {country.currency}
          {fxRate && <span style={{ marginLeft: 6, fontWeight: 500, color: "var(--text3)", textTransform: "none", letterSpacing: 0 }}>
            · live rate {country.symbol}{fxRate.toFixed(2)}
          </span>}
        </div>
        <div style={card}>
          {/* Column headers */}
          <div style={{ display: "flex", padding: "2px 0 8px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ flex: 2,   fontSize: 9, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Service</span>
            <span style={{ flex: 1.2, fontSize: 9, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>You pay</span>
            <span style={{ flex: 1.8, fontSize: 9, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>They get</span>
          </div>

          {/* PasaPay row */}
          <div style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ flex: 2,   fontSize: 12, fontWeight: 800, color: "var(--green)" }}>⚡ JupRemit</span>
            <span style={{ flex: 1.2, fontSize: 12, fontWeight: 800, color: "var(--green)", textAlign: "right" }}>$100</span>
            <span style={{ flex: 1.8, fontSize: 12, fontWeight: 800, color: "var(--green)", textAlign: "right" }}>
              {country.symbol}{pasapayAmt.toLocaleString()}
            </span>
          </div>

          {/* Competitor rows — each with savings banner */}
          {compRows.map((r, i) => (
            <div key={r.name} style={{ borderBottom: i < compRows.length - 1 ? "1px solid var(--border)" : "none" }}>
              {/* Main row */}
              <div style={{ display: "flex", alignItems: "center", padding: "10px 0 6px" }}>
                <span style={{ flex: 2,   fontSize: 11, fontWeight: 700, color: "var(--text2)" }}>{r.name}</span>
                <div style={{ flex: 1.2, textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--red)" }}>{r.youPay}</div>
                  <div style={{ fontSize: 8,  fontWeight: 600, color: "var(--text3)" }}>{r.feeLabel}</div>
                </div>
                <span style={{ flex: 1.8, fontSize: 11, fontWeight: 700, color: "var(--text2)", textAlign: "right" }}>
                  {country.symbol}{r.amt.toLocaleString()}
                </span>
              </div>
              {/* Savings banner */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--green-bg)", border: "1px solid var(--green-b)",
                borderRadius: 10, padding: "7px 12px", marginBottom: 8,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--green-d)", lineHeight: 1.4 }}>
                  <div>With JupRemit family gets</div>
                  <div style={{ color: "var(--text3)" }}>
                    +{country.symbol}{r.rateGain.toLocaleString()} better rate
                    &nbsp;·&nbsp;save ${r.fee.toFixed(2)} fee
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "var(--green-d)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Total saved</div>
                  <div className="num" style={{ fontSize: 16, fontWeight: 900, color: "var(--green)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    +{country.symbol}{r.totalSave.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 4, lineHeight: 1.5, fontStyle: "italic" }}>
            * Fees &amp; rates are published estimates. PasaPay uses live mid-market rates.
          </div>
        </div>

        {/* Win banner — total savings vs top competitor */}
        {compRows[0] && (
          <div style={{
            background: "linear-gradient(135deg, var(--green-bg), #0A2010)",
            border: "1px solid var(--green-b)", borderRadius: 16,
            padding: "14px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green-d)", marginBottom: 10, letterSpacing: "0.04em" }}>
              VS {compRows[0].name} — sending $100
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              {/* Left: total local-currency win */}
              <div>
                <div style={{ fontSize: 10, color: "var(--green-d)", marginBottom: 3 }}>Total family advantage</div>
                <div className="num grad-green" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  +{country.symbol}{compRows[0].totalSave.toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 3 }}>
                  {country.symbol}{compRows[0].rateGain.toLocaleString()} better rate
                  &nbsp;+&nbsp;{country.symbol}{compRows[0].feeInLocal.toLocaleString()} fee equiv.
                </div>
              </div>
              {/* Right: breakdown */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "var(--green-d)", marginBottom: 2 }}>You save</div>
                <div className="num grad-green" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>${feeSaved}</div>
                <div style={{ fontSize: 9, color: "var(--green-d)", marginTop: 2 }}>in fees ✓</div>
              </div>
            </div>
          </div>
        )}

        {/* Default recipient */}
        {defaultRecipient && (
          <>
            <div className="label-xs">Default Recipient</div>
            <button onClick={onSend} style={{
              ...card, display: "flex", alignItems: "center", gap: 12,
              cursor: "pointer", width: "100%", textAlign: "left",
              fontFamily: "inherit", transition: "border-color 0.15s",
            }}
              onMouseOver={e => (e.currentTarget.style.borderColor = "var(--green)")}
              onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--teal-bg)", border: "1px solid var(--teal-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                {defaultRecipient.flag}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{defaultRecipient.name}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {defaultRecipient.provider} · {defaultRecipient.currency} · {defaultRecipient.wallet.slice(0, 10)}…
                </div>
              </div>
              <div style={{ background: "var(--green)", color: "var(--green-dk)", fontSize: 12, fontWeight: 800, padding: "8px 14px", borderRadius: 10, flexShrink: 0 }}>
                Send →
              </div>
            </button>
          </>
        )}

        {/* Refresh */}
        <button onClick={refreshAll} style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 12, padding: "10px", fontSize: 12, fontWeight: 700, color: "var(--text3)", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
          ↻ Refresh balance
        </button>

        {/* How it works */}
        <div className="label-xs" style={{ marginTop: 20 }}>How JupRemit works</div>
        {([
          { icon: "💳", t: "Funded through JupCard",           d: "Your salary lands in JupCard — either by setting it as your direct deposit receiver or by manually sending from your paycard via ACH. JupRemit reads your JupCard balance and you decide: remit now, save in the Vault, or do both." },
          { icon: "⚡", t: "Zero-fee swap via Jupiter",       d: "USDC → JupUSD → USDC via Jupiter Ultra Swap. JupUSD trades at a small premium — net positive for the sender in under 1 second." },
          { icon: "📈", t: "Earn yield while waiting",        d: `Park USDC in JUICED (Jupiter Lend) at ${apy}% APY for up to 30 days. Your recipient receives more, not less.` },
          { icon: "🌍", t: "Recipient gets local currency",   d: `Arrives in their local wallet — GCash, Paytm, M-Pesa, Nubank, and 50+ providers across ${COUNTRIES.length} countries and growing.` },
        ] as const).map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 2 }}>{s.t}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", lineHeight: 1.55 }}>{s.d}</div>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
