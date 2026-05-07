"use client";
import React from "react";

function BackspaceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
      <line x1="18" y1="9" x2="12" y2="15" />
      <line x1="12" y1="9" x2="18" y2="15" />
    </svg>
  );
}

const KEYS = ["1","2","3","4","5","6","7","8","9",".","0","⌫"] as const;

export interface NumpadProps {
  value:        string;
  onChange:     (v: string) => void;
  maxDecimals?: number;
}

export function Numpad({ value, onChange, maxDecimals = 2 }: NumpadProps) {
  function press(k: string) {
    if (k === "⌫") {
      onChange(value.length > 1 ? value.slice(0, -1) : "0");
      return;
    }
    if (k === ".") {
      if (!value.includes(".")) onChange(value + ".");
      return;
    }
    if (value.includes(".")) {
      const dec = value.split(".")[1] ?? "";
      if (dec.length >= maxDecimals) return;
    }
    onChange(value === "0" ? k : value + k);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {KEYS.map((k) => (
        <NumKey key={k} label={k} onPress={() => press(k)} />
      ))}
    </div>
  );
}

function NumKey({ label, onPress }: { label: string; onPress: () => void }) {
  const [down, setDown] = React.useState(false);
  const isBack = label === "⌫";
  const isDot  = label === ".";

  return (
    <button
      onPointerDown={() => setDown(true)}
      onPointerUp={() => { setDown(false); onPress(); }}
      onPointerCancel={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        height: 64,
        background: down
          ? "rgba(255,255,255,0.10)"
          : isBack ? "var(--surface2)" : "var(--surface)",
        border: isBack
          ? `1px solid ${down ? "var(--text2)" : "var(--border2)"}`
          : "1px solid var(--border)",
        borderRadius: 16,
        fontSize: isDot ? 30 : isBack ? 18 : 24,
        fontWeight: isDot ? 900 : 500,
        color: isBack ? "var(--text2)" : "var(--text)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: down ? "scale(0.91)" : "scale(1)",
        transition: "background 0.07s, transform 0.07s, border-color 0.07s",
        userSelect: "none",
        WebkitUserSelect: "none" as React.CSSProperties["WebkitUserSelect"],
        fontFamily: "inherit",
        outline: "none",
        letterSpacing: isDot ? 0 : "-0.01em",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {isBack ? <BackspaceIcon /> : label}
    </button>
  );
}
