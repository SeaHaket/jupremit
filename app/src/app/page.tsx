"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

const HomeScreen    = dynamic(() => import("@/components/screens/HomeScreen"),    { ssr: false });
const SendScreen    = dynamic(() => import("@/components/screens/SendScreen"),    { ssr: false });
const VaultScreen   = dynamic(() => import("@/components/screens/VaultScreen"),   { ssr: false });
const AccountScreen = dynamic(() => import("@/components/screens/AccountScreen"), { ssr: false });

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
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {tab === "home"    && <HomeScreen    onSend={() => setTab("send")}  onVault={() => setTab("vault")} />}
        {tab === "send"    && <SendScreen    onBack={() => setTab("home")} />}
        {tab === "vault"   && <VaultScreen   onBack={() => setTab("home")} />}
        {tab === "account" && <AccountScreen />}
      </div>

      {/* Tab bar — always at bottom, never overlaps content */}
      <div style={{
        display: "flex", background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,  /* never collapses */
      }}>
        {([
          { id: "home",    icon: "⌂", label: "Home"    },
          { id: "send",    icon: "↗", label: "Send"    },
          { id: "vault",   icon: "🔒", label: "Vault"   },
          { id: "account", icon: "◎", label: "Account" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "10px 4px 14px", gap: 3,
              fontSize: 10, fontWeight: 600,
              color: tab === t.id ? "var(--green)" : "var(--text3)",
              background: "transparent", border: "none",
              cursor: "pointer", fontFamily: "inherit",
              transition: "color 0.15s",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
