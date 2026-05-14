"use client";
import { useEffect, useState } from "react";

interface Props {
  walletAddress: string;
  countryCode:   string;
  currencyCode:  string;
  recipientName?: string;
  onClose:       () => void;
}

export function FonbnkCashoutModal({ walletAddress, countryCode, currencyCode, recipientName, onClose }: Props) {
  const [url, setUrl]         = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ address: walletAddress, country: countryCode, currency: currencyCode });
    fetch(`/api/fonbnk/widget-token?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.url) setUrl(d.url);
        else setError(d.error ?? "Failed to load cashout widget");
      })
      .catch(() => setError("Network error — please try again"))
      .finally(() => setLoading(false));
  }, [walletAddress, countryCode, currencyCode]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.85)", display: "flex",
      flexDirection: "column", alignItems: "stretch",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", background: "var(--bg)",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            Cash Out via Fonbnk
          </div>
          {recipientName && (
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
              for {recipientName}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "var(--amber)",
            background: "var(--amber-bg)", border: "1px solid var(--amber-b)",
            borderRadius: 6, padding: "3px 8px", letterSpacing: "0.05em",
          }}>
            SANDBOX
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10,
            border: "1px solid var(--border)", background: "var(--surface2)",
            color: "var(--text2)", cursor: "pointer", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, position: "relative", background: "#fff" }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 14, background: "var(--bg)",
          }}>
            <div style={{
              width: 40, height: 40, border: "3px solid var(--green)",
              borderTopColor: "transparent", borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <div style={{ fontSize: 13, color: "var(--text2)" }}>Loading Fonbnk…</div>
          </div>
        )}

        {error && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 12, padding: 32, background: "var(--bg)",
          }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--red)" }}>Failed to load</div>
            <div style={{ fontSize: 12, color: "var(--text2)", textAlign: "center" }}>{error}</div>
            <button onClick={onClose} className="btn-primary" style={{ maxWidth: 160, marginTop: 8 }}>
              Close
            </button>
          </div>
        )}

        {url && (
          <iframe
            src={url}
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="camera; clipboard-write"
            title="Fonbnk cashout"
          />
        )}
      </div>
    </div>
  );
}
