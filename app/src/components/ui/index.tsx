"use client";

import type { ReactNode } from "react";

// ─── Tab bar ──────────────────────────────────────────────────────────────────
type Tab = "home" | "send" | "vault" | "account";

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "home",    label: "Home",    icon: "⌂"  },
    { id: "send",    label: "Send",    icon: "↗"  },
    { id: "vault",   label: "Vault",   icon: "🔒" },
    { id: "account", label: "Account", icon: "◎"  },
  ];
  return (
    <div className="tab-bar fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-50">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab-item${active === t.id ? " active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="text-base leading-none">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Status bar ───────────────────────────────────────────────────────────────
export function StatusBar({ title }: { title?: string }) {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return (
    <div className="flex justify-between items-center px-5 pt-3 pb-1">
      <span className="text-[11px] font-bold text-[var(--text)]">{time}</span>
      {title && (
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--green)]">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#C7F284"/>
            <path d="M8 10h10a6 6 0 010 12H8" stroke="#0D1A00" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="22" cy="16" r="2.5" fill="#0D1A00"/>
          </svg>
          {title}
        </span>
      )}
      <span className="text-[10px] text-[var(--text2)]">●●● 4G</span>
    </div>
  );
}

// ─── Screen header with back button ──────────────────────────────────────────
export function ScreenHeader({
  title, onBack, right,
}: {
  title: string; onBack?: () => void; right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
      {onBack ? (
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center text-[var(--text2)] hover:text-[var(--text)]">
          ←
        </button>
      ) : (
        <div className="w-8" />
      )}
      <span className="text-[13px] font-bold text-[var(--text)]">{title}</span>
      <div className="w-8 flex justify-end">{right}</div>
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ size = 16, color = "var(--green)" }: { size?: number; color?: string }) {
  return (
    <span
      className="spin inline-block rounded-full border-2"
      style={{
        width:  size, height: size,
        borderColor: `${color}33`,
        borderTopColor: color,
      }}
    />
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
export function Skeleton({ h = 16, w = "100%", className = "" }: { h?: number; w?: string | number; className?: string }) {
  return <span className={`skeleton block ${className}`} style={{ height: h, width: w }} />;
}

// ─── Amount display ───────────────────────────────────────────────────────────
export function AmountDisplay({
  usd, local, localCurrency, localSymbol, isEstimate = true, size = "lg",
}: {
  usd: number; local?: number | null; localCurrency?: string;
  localSymbol?: string; isEstimate?: boolean; size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = { sm: "text-xl", md: "text-2xl", lg: "text-3xl" };
  const subClasses  = { sm: "text-xs",  md: "text-sm",  lg: "text-base" };
  return (
    <div className="text-center">
      <div className={`${sizeClasses[size]} font-bold text-[var(--text)]`}>
        ${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{" "}
        <span className="text-[var(--text3)] font-semibold">USDC</span>
      </div>
      {local != null && (
        <div className={`${subClasses[size]} text-[var(--text2)] mt-0.5`}>
          ≈ {localSymbol}{local.toLocaleString("en-US")} {localCurrency}
          {isEstimate && (
            <span className="text-[var(--amber)] text-[9px] font-bold bg-[var(--amber-bg)] px-1.5 py-0.5 rounded ml-1">est.</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Win banner ───────────────────────────────────────────────────────────────
export function WinBanner({
  extraLocal, localSymbol, currency, vs = "Brightwell",
}: {
  extraLocal: number; localSymbol: string; currency: string; vs?: string;
}) {
  return (
    <div className="bg-gradient-to-r from-[var(--green-bg)] to-[#0A2010] border border-[var(--green-b)] rounded-2xl px-4 py-3 flex justify-between items-center">
      <div>
        <div className="label-xs text-[var(--green-d)]">Recipient gets extra</div>
        <div className="text-xl font-bold text-[var(--green)]">
          +{localSymbol}{Math.round(extraLocal).toLocaleString()}
          <span className="badge badge-amber ml-2">est.</span>
        </div>
        <div className="text-[10px] text-[var(--green-d)]">vs {vs} this transfer</div>
      </div>
      <div className="text-right">
        <div className="text-[9px] text-[var(--green-d)]">Fee saved</div>
        <div className="text-base font-bold text-[var(--green)]">$7.997</div>
        <div className="text-[9px] text-[var(--green-d)]">guaranteed ✓</div>
      </div>
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-none border-t border-[var(--border)] my-2 ${className}`} />;
}

// ─── Info box ────────────────────────────────────────────────────────────────
export function InfoBox({ icon = "ℹ️", children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3 py-2.5">
      <span className="text-sm flex-shrink-0 mt-0.5">{icon}</span>
      <div className="text-[11px] text-[var(--text2)] leading-relaxed">{children}</div>
    </div>
  );
}

// ─── LiveDot ─────────────────────────────────────────────────────────────────
export function LiveDot() {
  return <span className="live-dot mr-1" />;
}

// ─── Powered-by strip ────────────────────────────────────────────────────────
export function PoweredBy() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-3 flex-wrap">
      <span className="text-[9px] text-[var(--text3)]">Powered by</span>
      {["Ultra Swap", "Jupiter Lend", "JupCard", "Solana"].map((n) => (
        <span key={n} className="text-[9px] font-bold bg-[var(--surface2)] text-[var(--green)] px-1.5 py-0.5 rounded-full border border-[var(--border)]">
          {n}
        </span>
      ))}
    </div>
  );
}
