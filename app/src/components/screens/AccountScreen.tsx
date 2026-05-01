"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRecipientStore } from "@/store/jupremit";

const COUNTRIES = [
  { flag: "🇵🇭", name: "Philippines", currency: "PHP", providers: ["Coins.ph", "GCash", "Maya"] },
  { flag: "🇮🇩", name: "Indonesia",   currency: "IDR", providers: ["GoPay", "OVO", "DANA"] },
  { flag: "🇻🇳", name: "Vietnam",     currency: "VND", providers: ["MoMo", "ZaloPay"] },
  { flag: "🇹🇭", name: "Thailand",    currency: "THB", providers: ["PromptPay", "TrueMoney"] },
  { flag: "🇲🇾", name: "Malaysia",    currency: "MYR", providers: ["Touch'n Go", "DuitNow"] },
  { flag: "🇸🇬", name: "Singapore",   currency: "SGD", providers: ["PayNow", "GrabPay"] },
  { flag: "🇬🇧", name: "UK",          currency: "GBP", providers: ["Faster Payments", "Wise"] },
  { flag: "🇺🇸", name: "USA",         currency: "USD", providers: ["ACH", "Venmo", "Zelle"] },
  { flag: "🇳🇬", name: "Nigeria",     currency: "NGN", providers: ["OPay", "Flutterwave"] },
  { flag: "🇰🇪", name: "Kenya",       currency: "KES", providers: ["M-Pesa"] },
  { flag: "🇮🇳", name: "India",       currency: "INR", providers: ["UPI", "PhonePe"] },
  { flag: "🇧🇷", name: "Brazil",      currency: "BRL", providers: ["Pix", "Nubank"] },
];

type AStep = "main" | "add";

export default function AccountScreen() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { recipients, addRecipient, removeRecipient, setDefault } = useRecipientStore();

  const [step, setStep]               = useState<AStep>("main");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [selectedProvider, setSelectedProvider] = useState(COUNTRIES[0].providers[0]);
  const [name, setName]               = useState("");
  const [wallet, setWallet]           = useState("");
  const [saved, setSaved]             = useState(false);

  const addr  = publicKey?.toBase58() ?? "";
  const short = addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";

  const handleAdd = () => {
    if (!name.trim() || !wallet.trim()) return;
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

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 12 };

  /* ── Add recipient screen ── */
  if (step === "add") return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)", position: "sticky" as const, top: 0, zIndex: 10 }}>
        <button onClick={() => setStep("main")} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text2)", fontSize: 18 }}>←</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Add Recipient</span>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ padding: 16 }}>

        {saved && (
          <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-b)", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "var(--green)", marginBottom: 12, textAlign: "center" }}>
            ✅ Recipient saved!
          </div>
        )}

        {/* Name */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Name</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="input-field"
          placeholder="e.g. Maria Santos"
          style={{ marginBottom: 16 }}
        />

        {/* Country */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Country</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {COUNTRIES.map(c => (
            <button
              key={c.name}
              onClick={() => { setSelectedCountry(c); setSelectedProvider(c.providers[0]); }}
              style={{
                padding: "10px 12px", borderRadius: 12,
                border: `1px solid ${selectedCountry.name === c.name ? "var(--green)" : "var(--border)"}`,
                background: selectedCountry.name === c.name ? "var(--green-bg)" : "var(--surface2)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                textAlign: "left" as const, fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 20 }}>{c.flag}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{c.name}</div>
                <div style={{ fontSize: 9, color: "var(--text3)" }}>{c.currency}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Provider */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Provider / App</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 16 }}>
          {selectedCountry.providers.map(p => (
            <button
              key={p}
              onClick={() => setSelectedProvider(p)}
              style={{
                padding: "8px 14px", borderRadius: 20, fontFamily: "inherit",
                border: `1px solid ${selectedProvider === p ? "var(--teal)" : "var(--border)"}`,
                background: selectedProvider === p ? "var(--teal-bg)" : "transparent",
                color: selectedProvider === p ? "var(--teal)" : "var(--text2)",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}
            >{p}</button>
          ))}
        </div>

        {/* Wallet address */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Solana Wallet Address</div>
        <input
          value={wallet}
          onChange={e => setWallet(e.target.value)}
          className="input-field"
          placeholder="e.g. 7xKX..."
          style={{ marginBottom: 6, fontFamily: "monospace" }}
        />
        <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 16 }}>Recipient's Solana address or Coins.ph/GCash linked address</div>

        <button
          className="btn-primary"
          onClick={handleAdd}
          disabled={!name.trim() || !wallet.trim()}
        >
          Add recipient →
        </button>
      </div>
    </div>
  );

  /* ── Main screen ── */
  return (
    <div>
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
                <span style={{ fontSize: 10, color: "var(--green)" }}>Connected .</span>
              </div>
            </div>
            <button
              onClick={() => disconnect()}
              style={{ fontSize: 10, color: "var(--text3)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
            >Disconnect</button>
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12, textAlign: "center" }}>Connect your Phantom wallet to get started</div>
            <button className="btn-primary" onClick={() => setVisible(true)}>Connect Wallet</button>
          </div>
        )}

        {/* Recipients */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Recipients ({recipients.length})</div>
          <button
            onClick={() => setStep("add")}
            style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--green-b)", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit" }}
          >+ Add</button>
        </div>

        {recipients.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "32px 16px" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>No recipients yet</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 16 }}>Add your family member's Solana wallet to start sending</div>
            <button
              className="btn-primary"
              style={{ maxWidth: 180, margin: "0 auto" }}
              onClick={() => setStep("add")}
            >Add recipient</button>
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
                  <button
                    onClick={() => setDefault(r.id)}
                    style={{ fontSize: 9, color: "var(--text2)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                  >Default</button>
                )}
                <button
                  onClick={() => removeRecipient(r.id)}
                  style={{ fontSize: 9, color: "var(--red)", background: "none", border: "1px solid var(--red-b)", borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                >✕</button>
              </div>
            </div>
          ))
        )}

        {/* Network info */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 8 }}>Network</div>
        <div style={{ ...card, background: "var(--surface2)" }}>
          {[
            ["Network", "Solana Mainnet"],
            ["Program", "EXjLoxj7...QUS"],
            ["Swap API", "Jupiter Ultra V2"],
            ["Lend API", "Jupiter Earn"],
            ["Fees", "$0.003 gas only"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, color: "var(--text2)" }}>{k}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", fontFamily: k === "Program" ? "monospace" : "inherit" }}>{v}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
