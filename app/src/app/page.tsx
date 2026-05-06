"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

const Spinner = () => (
  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
    <div className="spin" style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid var(--border2)", borderTopColor: "var(--green)" }} />
  </div>
);

const HomeScreen    = dynamic(() => import("@/components/screens/HomeScreen"),    { ssr: false, loading: Spinner });
const SendScreen    = dynamic(() => import("@/components/screens/SendScreen"),    { ssr: false, loading: Spinner });
const VaultScreen   = dynamic(() => import("@/components/screens/VaultScreen"),   { ssr: false, loading: Spinner });
const AccountScreen = dynamic(() => import("@/components/screens/AccountScreen"), { ssr: false, loading: Spinner });

type Tab = "home" | "send" | "vault" | "account";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", maxWidth: 430, margin: "0 auto",
      background: "var(--bg)", position: "relative",
    }}>

      {/* Scrollable screen area — leaves room for tab bar */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "home"    && <HomeScreen    onSend={() => setTab("send")}  onVault={() => setTab("vault")} />}
        {tab === "send"    && <SendScreen    onBack={() => setTab("home")} />}
        {tab === "vault"   && <VaultScreen   onBack={() => setTab("home")} />}
        {tab === "account" && <AccountScreen />}
      </div>

      {/* Tab bar — always at bottom, safe-area aware */}
      <div style={{
        display: "flex", background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {([
          { id: "home",    label: "Home"    },
          { id: "send",    label: "Send"    },
          { id: "vault",   label: "Vault"   },
          { id: "account", label: "Account" },
        ] as const).map(t => {
          const active = tab === t.id;
          const c      = active ? "var(--green)" : "var(--text3)";
          const bg     = active ? "var(--bg)"    : "none";
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "10px 4px 14px", gap: 4,
                fontSize: 10, fontWeight: active ? 700 : 600,
                color: c,
                background: "transparent", border: "none",
                cursor: "pointer", fontFamily: "inherit",
                transition: "color 0.15s",
              }}
            >
              {/* ── Home: house with door ── */}
              {t.id === "home" && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  {/* Roof & walls */}
                  <path
                    d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10.5z"
                    fill={active ? c : "none"}
                    stroke={c} strokeWidth="1.75"
                  />
                  {/* Door cutout */}
                  <rect
                    x="9" y="14" width="6" height="7" rx="1"
                    fill={active ? bg : "none"}
                    stroke={active ? bg : c} strokeWidth="1.75"
                  />
                </svg>
              )}

              {/* ── Send: paper plane (Phosphor-style) ── */}
              {t.id === "send" && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path
                    d="M22 2L11 13"
                    stroke={c} strokeWidth="1.75"
                  />
                  <path
                    d="M22 2L15 22 11 13 2 9 22 2z"
                    fill={active ? c : "none"}
                    stroke={c} strokeWidth="1.75"
                  />
                </svg>
              )}

              {/* ── Vault: combination lock / safe ── */}
              {t.id === "vault" && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  {/* Safe body */}
                  <rect
                    x="3" y="5" width="18" height="15" rx="2.5"
                    fill={active ? c : "none"}
                    stroke={c} strokeWidth="1.75"
                  />
                  {/* Dial ring */}
                  <circle
                    cx="12" cy="12.5" r="3.5"
                    fill={active ? bg : "none"}
                    stroke={active ? bg : c} strokeWidth="1.6"
                  />
                  {/* Dial center dot */}
                  <circle cx="12" cy="12.5" r="1" fill={active ? bg : c} />
                  {/* Right handle */}
                  <path d="M21 9.5h2M21 15.5h2" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
                  {/* Bottom feet */}
                  <path d="M8 20v2M16 20v2" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              )}

              {/* ── Account: person in circle ── */}
              {t.id === "account" && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  {/* Outer circle */}
                  <circle
                    cx="12" cy="12" r="10"
                    fill={active ? c : "none"}
                    stroke={c} strokeWidth="1.75"
                  />
                  {/* Head */}
                  <circle
                    cx="12" cy="10" r="3"
                    fill={active ? bg : "none"}
                    stroke={active ? bg : c} strokeWidth="1.6"
                  />
                  {/* Shoulders curve */}
                  <path
                    d="M5.5 20.5Q6 15.5 12 15.5Q18 15.5 18.5 20.5"
                    fill="none"
                    stroke={active ? bg : c} strokeWidth="1.6"
                  />
                </svg>
              )}

              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
