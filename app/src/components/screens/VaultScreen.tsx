"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAppStore } from "@/store/jupremit";
import { Numpad } from "../ui/Numpad";

type VStep = "configure" | "confirm" | "active";
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

function Hdr({ title, back }: { title: string; back: () => void }) {
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
      <div style={{ width: 36 }} />
    </div>
  );
}

export default function VaultScreen({ onBack }: Props) {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { juicedApy } = useAppStore();

  const [step, setStep]           = useState<VStep>("configure");
  const [monthlyInput, setMonthlyInput] = useState("200");
  const [months, setMonths]       = useState(3);
  const [creating, setCreating]   = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);

  const monthly = parseFloat(monthlyInput) || 0;
  const total   = monthly * months;
  const yield_  = total * (juicedApy / 100) * (months / 12);
  const net     = total + yield_;

  useEffect(() => {
    if (!publicKey) return;
    fetch(`/api/balance?wallet=${publicKey.toBase58()}&network=mainnet-beta`)
      .then(r => r.json()).then(d => setUsdcBalance(d.usdc ?? null)).catch(() => {});
  }, [publicKey?.toBase58()]);

  function handleNumpad(v: string) {
    setMonthlyInput(v);
  }

  function pctOfBalance(pct: number): number {
    if (!usdcBalance || usdcBalance <= 0) return 0;
    return Math.floor(usdcBalance * pct * 100) / 100;
  }

  function setPreset(val: number) {
    const rounded = Math.floor(val * 100) / 100;
    setMonthlyInput(rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2));
  }

  // ─── Not connected ──────────────────────────────────────────────────────────
  if (!connected) return (
    <div style={{ position: "relative", zIndex: 0 }}>
      <Wm />
      <Hdr title="Savings Vault" back={onBack} />
      <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--purple-bg)", border: "1px solid var(--purple-b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Connect wallet to use Vault</div>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
          Earn <strong style={{ color: "var(--purple)" }}>{juicedApy}% APY</strong> on monthly savings while your family earns yield until release.
        </div>
        <button className="btn-primary" style={{ maxWidth: 200, background: "var(--purple)", color: "#fff", marginTop: 8 }} onClick={() => setVisible(true)}>Connect Wallet</button>
      </div>
    </div>
  );

  // ─── Active vault ───────────────────────────────────────────────────────────
  if (step === "active") return (
    <div style={{ position: "relative", zIndex: 0 }}>
      <Wm />
      <Hdr title="Active Vault" back={onBack} />
      <div style={{ padding: 16 }}>
        <div style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-b)", borderRadius: 16, padding: 16, marginBottom: 12 }}>
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

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
          <div><div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 4 }}>APY</div><div style={{ fontSize: 18, fontWeight: 700, color: "var(--purple)" }}>{juicedApy}%</div></div>
          <div><div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 4 }}>Monthly</div><div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>${monthly.toFixed(0)}</div></div>
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

  // ─── Confirm step ───────────────────────────────────────────────────────────
  if (step === "confirm") return (
    <div style={{ position: "relative", zIndex: 0 }}>
      <Wm />
      <Hdr title="Confirm Vault" back={() => setStep("configure")} />
      <div style={{ padding: 16 }}>
        <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 6 }}>Creating a vault for</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
            ${monthly.toFixed(2)}<span style={{ fontSize: 16, color: "var(--text3)", fontWeight: 500 }}>/mo</span> × {months} months
          </div>
        </div>
        <div style={{ background: "var(--surface2)", borderRadius: 16, padding: "4px 16px", marginBottom: 12 }}>
          {[
            ["Total to deposit",   `$${total.toFixed(2)}`,                           false],
            ["Duration",           `${months} months`,                                false],
            ["APY (est.)",         `${juicedApy}%`,                                  true ],
            ["Yield earned (est.)",`+$${yield_.toFixed(2)}`,                         true ],
            ["Net return (est.)",  `$${net.toFixed(2)}`,                             true ],
            ["Return %",           `+${total > 0 ? ((yield_ / total) * 100).toFixed(2) : "0.00"}%`, true],
          ].map(([k, v, g]) => (
            <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text2)" }}>{k as string}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: g ? "var(--green)" : "var(--text)" }}>{v as string}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-b)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 11, color: "var(--amber)" }}>
          🔒 Funds go to JUICED (Jupiter Lend) and return to <strong>your</strong> wallet at maturity.
        </div>
        <button
          className="btn-primary"
          style={{ background: "var(--purple)", color: "#fff", marginBottom: 8 }}
          disabled={creating || monthly < 10}
          onClick={async () => {
            setCreating(true);
            await new Promise(r => setTimeout(r, 1500));
            setCreating(false);
            setStep("active");
          }}
        >
          {creating ? "Creating vault…" : `Create vault · $${monthly.toFixed(0)} × ${months}mo →`}
        </button>
        <button onClick={() => setStep("configure")} style={{ width: "100%", background: "none", border: "none", color: "var(--text3)", fontSize: 13, cursor: "pointer", padding: 8, fontFamily: "inherit" }}>Back</button>
      </div>
    </div>
  );

  // ─── Configure step (Jupiter-style numpad layout) ───────────────────────────
  const dim = !usdcBalance || usdcBalance <= 0;

  return (
    <div style={{ position: "relative", zIndex: 0, display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Wm />
      <Hdr title="Seafarer Savings Vault" back={onBack} />

      {/* APY header */}
      <div style={{ margin: "12px 16px 0", background: "var(--purple-bg)", border: "1px solid var(--purple-b)", borderRadius: 20, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>JUICED APY</div>
          <div className="num grad-purple" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>{juicedApy}%</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500, marginBottom: 3 }}>via Jupiter Lend</div>
          <div style={{ fontSize: 10, color: "var(--text3)" }}>returns to YOUR wallet</div>
        </div>
      </div>

      {/* ── Monthly amount — center stage ── */}
      <div style={{ padding: "20px 16px 4px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Monthly Deposit</div>
        {(() => {
          const digits = monthlyInput.replace(".", "").length;
          const numFs  = digits <= 3 ? 52 : digits <= 5 ? 44 : digits <= 7 ? 36 : 30;
          const dolFs  = Math.round(numFs * 0.5);
          return (
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: dolFs, fontWeight: 600, lineHeight: 1,
                color: monthly > 0 ? "rgba(168,156,255,0.45)" : "var(--text3)" }}>$</span>
              <span className="num" style={{
                fontSize: numFs, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em",
                ...(monthly > 0 ? {
                  background: "linear-gradient(175deg, #C8C0FF 0%, #8A7DFF 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                } : { color: "var(--text3)" }),
              }}>{monthlyInput}</span>
            </div>
          );
        })()}
        <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, marginTop: 4, letterSpacing: "0.08em" }}>USDC</div>

        {/* Yield preview below amount */}
        {monthly > 0 && (
          <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 6 }}>
            {months} months → <strong style={{ color: "var(--purple)" }}>+${yield_.toFixed(2)}</strong> yield <span className="badge-est">est.</span>
          </div>
        )}

        {/* Percentage presets — from wallet balance */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          {([
            { label: "25%", pct: 0.25 },
            { label: "½",   pct: 0.50 },
            { label: "75%", pct: 0.75 },
            { label: "MAX", pct: 1.00 },
          ] as const).map(({ label, pct }) => {
            const val    = pctOfBalance(pct);
            const active = !dim && Math.abs(monthly - val) < 0.01;
            return (
              <button key={label} onClick={() => !dim && setPreset(val)} style={{
                padding: "7px 0", width: 58, borderRadius: 22, fontSize: 12, fontWeight: 700,
                border: `1px solid ${active ? "var(--purple-b)" : "var(--border)"}`,
                background: active ? "var(--purple-bg)" : "var(--surface)",
                color: active ? "var(--purple)" : dim ? "var(--text3)" : "var(--text2)",
                cursor: dim ? "default" : "pointer", fontFamily: "inherit",
                transition: "all 0.12s", opacity: dim ? 0.4 : 1,
                display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 1,
              }}>
                <span>{label}</span>
                {!dim && (
                  <span style={{ fontSize: 8, color: active ? "var(--purple)" : "var(--text3)", fontWeight: 600 }}>
                    ${val.toFixed(0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Numpad ── */}
      <div style={{ padding: "14px 16px 12px" }}>
        <Numpad value={monthlyInput} onChange={handleNumpad} />
      </div>

      {/* ── Duration picker ── */}
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Duration</div>
        <div style={{ display: "flex", gap: 8 }}>
          {([1, 2, 3, 4, 5] as const).map(m => (
            <button key={m} onClick={() => setMonths(m)} style={{
              flex: 1, padding: "12px 4px", borderRadius: 14, fontSize: 12, fontWeight: 700,
              border: `1px solid ${months === m ? "var(--purple-b)" : "var(--border)"}`,
              background: months === m ? "var(--purple-bg)" : "var(--surface)",
              color: months === m ? "var(--purple)" : "var(--text2)",
              cursor: "pointer", fontFamily: "inherit", textAlign: "center" as const,
            }}>
              <div>{m}mo</div>
              {monthly > 0 && (
                <div style={{ fontSize: 8, marginTop: 2, color: months === m ? "var(--purple)" : "var(--text3)" }}>
                  +${(monthly * m * (juicedApy / 100) * (m / 12)).toFixed(2)}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Projection summary ── */}
      {monthly > 0 && (
        <div style={{ margin: "0 16px 12px", background: "var(--surface2)", borderRadius: 14, padding: "4px 14px" }}>
          {[
            ["Total deposited", `$${total.toFixed(2)}`,  false],
            ["Yield earned",    `+$${yield_.toFixed(4)}`, true ],
            ["Net return",      `$${net.toFixed(2)}`,     true ],
            ["Return %",        `+${total > 0 ? ((yield_ / total) * 100).toFixed(2) : "0.00"}%`, true],
          ].map(([l, v, g]) => (
            <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text2)" }}>{l as string} <span className="badge-est">est.</span></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: g ? "var(--green)" : "var(--text)" }}>{v as string}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Review button ── */}
      <div style={{ padding: "0 16px 24px" }}>
        <button
          className="btn-primary"
          style={{ background: "var(--purple)", color: "#fff" }}
          disabled={monthly < 10}
          onClick={() => setStep("confirm")}
        >
          {monthly < 10 ? "Enter $10 minimum" : `Review vault · $${monthly.toFixed(0)}/mo × ${months} months →`}
        </button>
      </div>
    </div>
  );
}
