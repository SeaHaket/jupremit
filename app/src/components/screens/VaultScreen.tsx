"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAppStore } from "@/store/jupremit";

type VStep = "configure" | "confirm" | "active";
interface Props { onBack: () => void; }

export default function VaultScreen({ onBack }: Props) {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { juicedApy } = useAppStore();

  const [step, setStep]       = useState<VStep>("configure");
  const [monthly, setMonthly] = useState(200);
  const [months, setMonths]   = useState(3);
  const [creating, setCreating] = useState(false);

  const total  = monthly * months;
  const yield_ = total * (juicedApy / 100) * (months / 12);
  const net    = total + yield_;

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 12 };
  const hdr = (title: string) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)", position: "sticky" as const, top: 0, zIndex: 10 }}>
      <button onClick={() => step === "confirm" ? setStep("configure") : onBack()} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text2)", fontSize: 18 }}>←</button>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</span>
      <div style={{ width: 32 }} />
    </div>
  );

  if (!connected) return (
    <div>
      {hdr("Savings Vault")}
      <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
        <div style={{ fontSize: 56 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Connect wallet to use Vault</div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>Earn {juicedApy}% APY on your monthly savings while your family can claim anytime</div>
        <button className="btn-primary" style={{ maxWidth: 200, marginTop: 8 }} onClick={() => setVisible(true)}>Connect Wallet</button>
      </div>
    </div>
  );

  if (step === "active") return (
    <div>
      {hdr("Active Vault")}
      <div style={{ padding: 16 }}>
        <div style={{ ...card, background: "var(--purple-bg)", border: "1px solid var(--purple-b)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 4 }}>Total deposited</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>${total.toFixed(2)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 4 }}>Projected yield <span className="badge-est">est.</span></div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--purple)" }}>+${yield_.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{ width: `${(1 / months) * 100}%`, height: "100%", background: "var(--purple)", borderRadius: 8, transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--text3)" }}>
            <span>Month 1 of {months}</span><span>{months - 1} months remaining</span>
          </div>
        </div>

        <div style={{ ...card, display: "flex", justifyContent: "space-between" }}>
          <div><div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 4 }}>APY</div><div style={{ fontSize: 18, fontWeight: 700, color: "var(--purple)" }}>{juicedApy}%</div></div>
          <div><div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 4 }}>Monthly</div><div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>${monthly}</div></div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 4 }}>At maturity <span className="badge-est">est.</span></div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>${net.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-b)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 11, color: "var(--amber)" }}>
          🔒 Funds return to <strong>your</strong> wallet at maturity — you decide what to do next.
        </div>

        <button className="btn-primary" style={{ background: "var(--purple)", color: "#fff", marginBottom: 8 }}>Deposit month 2 →</button>
        <button onClick={() => setStep("configure")} style={{ width: "100%", background: "none", border: "none", color: "var(--text3)", fontSize: 13, cursor: "pointer", padding: 8, fontFamily: "inherit" }}>Start new vault</button>
      </div>
    </div>
  );

  if (step === "confirm") return (
    <div>
      {hdr("Confirm Vault")}
      <div style={{ padding: 16 }}>
        <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 4 }}>You are creating a vault for</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>${monthly}/month × {months} months</div>
        </div>
        <div style={{ ...card, background: "var(--surface2)" }}>
          {[
            ["Total to deposit", `$${total.toFixed(2)}`],
            ["Duration", `${months} months`],
            ["APY (est.)", `${juicedApy}%`],
            ["Yield earned (est.)", `+$${yield_.toFixed(2)}`],
            ["Net return (est.)", `$${net.toFixed(2)}`],
            ["Return %", `+${((yield_ / total) * 100).toFixed(2)}%`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text2)" }}>{k} {k.includes("est") && <span className="badge-est">est.</span>}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: v.startsWith("+") ? "var(--green)" : "var(--text)" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-b)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 11, color: "var(--amber)" }}>
          🔒 Funds go to JUICED (Jupiter Lend) and return to <strong>your</strong> wallet at maturity — not the recipient.
        </div>
        <button
          className="btn-primary"
          style={{ background: "var(--purple)", color: "#fff", marginBottom: 8 }}
          disabled={creating}
          onClick={async () => {
            setCreating(true);
            await new Promise(r => setTimeout(r, 1500));
            setCreating(false);
            setStep("active");
          }}
        >
          {creating ? "Creating vault…" : `Create vault · $${monthly} × ${months} months →`}
        </button>
        <button onClick={() => setStep("configure")} style={{ width: "100%", background: "none", border: "none", color: "var(--text3)", fontSize: 13, cursor: "pointer", padding: 8, fontFamily: "inherit" }}>Back</button>
      </div>
    </div>
  );

  /* Configure step */
  return (
    <div>
      {hdr("Seafarer Savings Vault")}
      <div style={{ padding: 16 }}>

        <div style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-b)", borderRadius: 16, padding: 16, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "var(--purple)" }}>{juicedApy}% <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text2)" }}>APY</span></div>
          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>JUICED by Jupiter Lend · returns to YOUR wallet at maturity</div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Monthly deposit amount</div>
        <div style={card}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[100, 200, 300, 500].map(a => (
              <button
                key={a}
                onClick={() => setMonthly(a)}
                style={{ flex: 1, padding: "10px 4px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${monthly === a ? "var(--purple)" : "var(--border)"}`, background: monthly === a ? "var(--purple-bg)" : "transparent", color: monthly === a ? "var(--purple)" : "var(--text2)", cursor: "pointer", fontFamily: "inherit" }}
              >${a}</button>
            ))}
          </div>
          <input
            type="number"
            value={monthly}
            onChange={e => setMonthly(Math.max(10, parseInt(e.target.value) || 10))}
            className="input-field"
            style={{ textAlign: "center", fontSize: 16, fontWeight: 700 }}
            min="10"
          />
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Duration</div>
        <div style={card}>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4, 5].map(m => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                style={{ flex: 1, padding: "12px 4px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${months === m ? "var(--purple)" : "var(--border)"}`, background: months === m ? "var(--purple-bg)" : "transparent", color: months === m ? "var(--purple)" : "var(--text2)", cursor: "pointer", fontFamily: "inherit" }}
              >{m}mo</button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Projection <span className="badge-est">est.</span></div>
        <div style={{ ...card, background: "var(--surface2)" }}>
          {[
            ["Total deposited", `$${total.toFixed(2)}`, false],
            ["Yield earned",    `+$${yield_.toFixed(4)}`, true],
            ["Net return",      `$${net.toFixed(2)}`, true],
            ["Return %",        `+${((yield_ / total) * 100).toFixed(2)}%`, true],
          ].map(([l, v, g]) => (
            <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text2)" }}>{l as string}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: g ? "var(--green)" : "var(--text)" }}>{v as string}</span>
            </div>
          ))}
        </div>

        <button
          className="btn-primary"
          style={{ background: "var(--purple)", color: "#fff" }}
          onClick={() => setStep("confirm")}
        >
          Review vault →
        </button>
      </div>
    </div>
  );
}
