"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRecipientStore } from "@/store/jupremit";

interface Props { onSend: () => void; onVault: () => void; }

export default function HomeScreen({ onSend, onVault }: Props) {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { defaultRecipient } = useRecipientStore();
  const [apy, setApy]         = useState(4.5);
  const [fxRate, setFxRate]   = useState(61.16);
  const [usdc, setUsdc]       = useState(0);
  const [sol, setSol]         = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    fetch("/api/apy").then(r => r.json()).then(d => setApy(d.apy ?? 4.5)).catch(() => {});
    fetch("/api/fx?currency=PHP").then(r => r.json()).then(d => setFxRate(d.rate ?? 61.16)).catch(() => {});

    if (publicKey) {
      setLoading(true);
      try {
        const addr = publicKey.toBase58();
        const res  = await fetch(`/api/balance?wallet=${addr}&network=mainnet-beta`);
        const data = await res.json();
        setUsdc(data.usdc ?? 0);
        setSol(data.sol ?? 0);
      } catch {}
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addr  = publicKey?.toBase58() ?? "";
  const short = addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: 16, marginBottom: 12,
  };
  const label: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.07em",
    marginBottom: 6, display: "block",
  };

  if (!connected) return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 12, textAlign: "center" }}>
      <img 
  src="/jupit-logo.png" 
  alt="Just Jup It" 
  style={{ 
    width: 180, 
    height: 180, 
    mixBlendMode: "screen",
    marginBottom: 8 
  }} 
/>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>Welcome to JupRemit</div>
      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
        DeFi remittance for OFWs.<br />
        <strong style={{ color: "var(--green)" }}>$0 fees</strong> · mid-market rates · <strong style={{ color: "var(--green)" }}>{apy}% yield</strong>
      </div>
      <button
        className="btn-primary"
        style={{ maxWidth: 240, marginTop: 8 }}
        onClick={() => setVisible(true)}
      >
        Connect Wallet
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 }}>
        {["Ultra Swap", "Jupiter Lend", "JupCard", "Solana"].map(n => (
          <span key={n} style={{ fontSize: 9, fontWeight: 700, background: "var(--surface2)", color: "var(--green)", padding: "2px 8px", borderRadius: 20, border: "1px solid var(--border)" }}>{n}</span>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: 16, paddingBottom: 32 }}>

      {/* Wallet row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--text2)", fontFamily: "monospace" }}>{short}</span>
        </div>
        <button
          onClick={() => disconnect()}
          style={{ fontSize: 10, color: "var(--text3)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}
        >
          Disconnect
        </button>
      </div>

      {/* Balance card */}
      <div style={card}>
        <div style={label}>JupCard Balance</div>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          {loading ? (
            <div style={{ fontSize: 13, color: "var(--text3)" }}>Loading...</div>
          ) : (
            <>
              <div style={{ fontSize: 30, fontWeight: 800, color: "var(--text)" }}>
                {usdc.toFixed(2)} <span style={{ fontSize: 16, color: "var(--text3)", fontWeight: 500 }}>USDC</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 4 }}>
                ≈ ₱{Math.round(usdc * fxRate).toLocaleString()} PHP &nbsp;
                <span className="badge-est">est.</span>
              </div>
              {sol > 0 && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{sol.toFixed(4)} SOL available for gas</div>
              )}
            </>
          )}
        </div>
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 10, color: "var(--text2)" }}>Earning in JUICED</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>{apy}% APY</span>
        </div>
      </div>

      {/* Send + Vault buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <button
          onClick={onSend}
          style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: 16, cursor: "pointer",
            textAlign: "center", display: "block", width: "100%",
            fontFamily: "inherit", transition: "border-color 0.15s",
          }}
          onMouseOver={e => (e.currentTarget.style.borderColor = "var(--green)")}
          onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <div style={{ fontSize: 26, marginBottom: 4 }}>↗</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Send</div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>$0 fee · instant</div>
        </button>
        <button
          onClick={onVault}
          style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: 16, cursor: "pointer",
            textAlign: "center", display: "block", width: "100%",
            fontFamily: "inherit", transition: "border-color 0.15s",
          }}
          onMouseOver={e => (e.currentTarget.style.borderColor = "var(--purple)")}
          onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <div style={{ fontSize: 26, marginBottom: 4 }}>🔒</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Vault</div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{apy}% APY · 1–5 months</div>
        </button>
      </div>

      {/* Competitor table */}
      <div style={label}>VS Competitors · $100 → PHP</div>
      <div style={card}>
        {([
          { name: "⚡ JupRemit", fee: "$0.003", php: Math.round(100 * fxRate), green: true },
          { name: "Brightwell",  fee: "$8.00",  php: Math.round(92 * (fxRate - 2.5)), green: false },
          { name: "MoneyGram",   fee: "$5.00",  php: Math.round(95 * (fxRate - 2.37)), green: false },
          { name: "Western Union", fee: "$6.99", php: Math.round(93 * (fxRate - 2.65)), green: false },
        ] as const).map((r, i) => (
          <div key={r.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "9px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: r.green ? "var(--green)" : "var(--text2)" }}>{r.name}</span>
            <span style={{ fontSize: 11, color: r.green ? "var(--green)" : "var(--text3)" }}>{r.fee}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: r.green ? "var(--green)" : "var(--text2)" }}>
              ₱{r.php.toLocaleString()} <span className="badge-est">est.</span>
            </span>
          </div>
        ))}
      </div>

      {/* Win banner */}
      <div style={{
        background: "linear-gradient(135deg, var(--green-bg), #0A2010)",
        border: "1px solid var(--green-b)", borderRadius: 16,
        padding: "14px 16px", display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--green-d)", marginBottom: 4 }}>Family gets extra vs Brightwell</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>
            +₱{(Math.round(100 * fxRate) - Math.round(92 * (fxRate - 2.5))).toLocaleString()}
            &nbsp;<span className="badge-est">est.</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "var(--green-d)", marginBottom: 4 }}>Fee saved</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--green)" }}>$7.997</div>
          <div style={{ fontSize: 9, color: "var(--green-d)" }}>guaranteed ✓</div>
        </div>
      </div>

      {/* Default recipient */}
      {defaultRecipient && (
        <>
          <div style={label}>Default Recipient</div>
          <button
            onClick={onSend}
            style={{
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
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{defaultRecipient.name}</div>
              <div style={{ fontSize: 10, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {defaultRecipient.provider} · {defaultRecipient.wallet.slice(0, 12)}…
              </div>
            </div>
            <div style={{ background: "var(--green)", color: "var(--green-dk)", fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 10, flexShrink: 0 }}>
              Send →
            </div>
          </button>
        </>
      )}

      {/* Refresh balance */}
      <button
        onClick={fetchData}
        style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 12, padding: "10px", fontSize: 12, color: "var(--text3)", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}
      >
        ↻ Refresh balance
      </button>

      {/* How it works */}
      <div style={{ ...label, marginTop: 20 }}>How JupRemit works</div>
      {[
        { icon: "💳", t: "Fund from JupCard", d: "You manually send your money or connect your Paycard to your JupCard virtual US account. USD arrives as USDC via ACH." },
        { icon: "⚡", t: "Instant Boost swap", d: "USDC→JupUSD→USDC via Jupiter Ultra. JupUSD trades at a premium — net positive in under 1 second." },
        { icon: "📈", t: "Or earn yield in transit", d: `Hold USDC in JUICED (Jupiter Lend) at ${apy}% APY up to 30 days before sending.` },
        { icon: "🇵🇭", t: "Family receives USDC", d: "Arrives in their Coins.ph or GCash wallet. They convert to PHP at the provider's rate." },
      ].map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
            {s.icon}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{s.t}</div>
            <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>{s.d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
