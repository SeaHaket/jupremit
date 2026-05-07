"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function QrUploadIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <rect x="15" y="15" width="3" height="3" rx="0.5" />
      <path d="M18 15v3h3" /><path d="M21 21h-3v-3" />
    </svg>
  );
}

function ScanFrame() {
  const c = 30, t = 3, r = 8;
  const s: React.CSSProperties = {
    position: "absolute", width: c, height: c,
    borderColor: "var(--green)", borderStyle: "solid",
  };
  return (
    <div style={{ position: "relative", width: 210, height: 210 }}>
      {/* corners */}
      <div style={{ ...s, top: 0, left: 0, borderWidth: `${t}px 0 0 ${t}px`, borderTopLeftRadius: r }} />
      <div style={{ ...s, top: 0, right: 0, borderWidth: `${t}px ${t}px 0 0`, borderTopRightRadius: r }} />
      <div style={{ ...s, bottom: 0, left: 0, borderWidth: `0 0 ${t}px ${t}px`, borderBottomLeftRadius: r }} />
      <div style={{ ...s, bottom: 0, right: 0, borderWidth: `0 ${t}px ${t}px 0`, borderBottomRightRadius: r }} />
      {/* scan line */}
      <div style={{
        position: "absolute", left: t, right: t, height: 2,
        background: "linear-gradient(90deg, transparent, var(--green) 30%, var(--green) 70%, transparent)",
        boxShadow: "0 0 8px var(--green)",
        animation: "qrScan 2s ease-in-out infinite",
        borderRadius: 1,
      }} />
    </div>
  );
}

interface Props {
  onResult: (address: string) => void;
  onClose: () => void;
}

export function QrScannerModal({ onResult, onClose }: Props) {
  const [mode, setMode]       = useState<"camera" | "image">("camera");
  const [error, setError]     = useState("");
  const [scanned, setScanned] = useState("");
  const [camReady, setCamReady] = useState(false);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const jsQRRef   = useRef<any>(null);

  useEffect(() => {
    import("jsqr").then(m => { jsQRRef.current = m.default; });
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(""); setScanned("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCamReady(true);

      const tick = () => {
        if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
        const v = videoRef.current;
        if (v.readyState === v.HAVE_ENOUGH_DATA && jsQRRef.current) {
          const c = canvasRef.current;
          c.width = v.videoWidth; c.height = v.videoHeight;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const code = jsQRRef.current(img.data, img.width, img.height);
          if (code?.data) {
            const val = code.data.trim();
            if (SOL_PUBKEY_RE.test(val)) {
              stopCamera();
              setScanned(val);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Camera access denied — use Gallery instead.");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (mode === "camera") startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [mode]);

  const handleImageFile = useCallback(async (file: File) => {
    setError(""); setScanned("");
    try {
      if (!jsQRRef.current) jsQRRef.current = (await import("jsqr")).default;
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQRRef.current(img.data, img.width, img.height);
      if (code?.data) {
        const val = code.data.trim();
        if (SOL_PUBKEY_RE.test(val)) { setScanned(val); return; }
        setError("QR found but doesn't contain a valid Solana address.");
      } else {
        setError("No QR code found. Try a clearer or closer photo.");
      }
    } catch { setError("Couldn't read this image."); }
  }, []);

  const handleClose = () => { stopCamera(); onClose(); };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(10,10,14,0.97)",
      display: "flex", flexDirection: "column",
      maxWidth: 390, margin: "0 auto",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px 12px",
        paddingTop: "max(20px, env(safe-area-inset-top))",
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>Scan Wallet QR</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>Solana address only</div>
        </div>
        <button onClick={handleClose} style={{
          width: 36, height: 36, borderRadius: 12,
          border: "1px solid var(--border2)", background: "var(--surface2)",
          color: "var(--text2)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer",
        }}>
          <XIcon />
        </button>
      </div>

      {/* ── Mode tabs ── */}
      <div style={{ padding: "0 16px 16px", display: "flex", gap: 6 }}>
        {(["camera", "image"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12,
            fontSize: 13, fontWeight: 700, border: "none",
            background: mode === m ? "var(--green-bg)" : "var(--surface)",
            color: mode === m ? "var(--green)" : "var(--text3)",
            outline: mode === m ? "1.5px solid var(--green-b)" : "1px solid var(--border)",
            outlineOffset: -1,
            cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.15s",
          }}>
            {m === "camera" ? "📷  Camera" : "🖼  Gallery"}
          </button>
        ))}
      </div>

      {/* ── Camera view ── */}
      {mode === "camera" && !scanned && (
        <div style={{ flex: 1, position: "relative", margin: "0 16px 16px", borderRadius: 28, overflow: "hidden", background: "#000" }}>
          <video ref={videoRef} playsInline muted autoPlay
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Vignette + frame */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.38)" }} />
            <ScanFrame />
          </div>

          {/* Status label */}
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)",
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
            padding: "6px 18px", borderRadius: 20, whiteSpace: "nowrap",
          }}>
            {camReady ? "Point at a Solana wallet QR code" : "Starting camera…"}
          </div>

          {/* Camera error overlay */}
          {error && (
            <div style={{
              position: "absolute", bottom: 56, left: 16, right: 16,
              background: "rgba(30,8,8,0.92)", border: "1px solid var(--red-b)",
              borderRadius: 14, padding: "12px 16px", textAlign: "center",
              fontSize: 13, color: "var(--red)", backdropFilter: "blur(8px)",
            }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Gallery / image upload ── */}
      {mode === "image" && !scanned && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px 24px", gap: 16 }}>
          <label style={{
            width: "100%", maxWidth: 300, aspectRatio: "1",
            border: "2px dashed var(--border2)", borderRadius: 28,
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 14, cursor: "pointer",
            color: "var(--text3)", transition: "border-color 0.15s",
          }}>
            <div style={{ color: "var(--green)", opacity: 0.7 }}>
              <QrUploadIcon />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Tap to select image</div>
              <div style={{ fontSize: 12 }}>PNG, JPG, or any screenshot</div>
            </div>
            <input
              type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => e.target.files?.[0] && handleImageFile(e.target.files[0])}
            />
          </label>

          {error && (
            <div style={{
              fontSize: 13, color: "var(--red)", background: "var(--red-bg)",
              border: "1px solid var(--red-b)", borderRadius: 14,
              padding: "12px 16px", width: "100%", textAlign: "center",
            }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Scanned result ── */}
      {scanned && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px 32px", gap: 22 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 22,
            background: "var(--green-bg)", border: "1px solid var(--green-b)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          }}>✅</div>

          <div style={{ textAlign: "center", width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>
              Solana address detected
            </div>
            <div style={{
              fontSize: 11, color: "var(--green)", fontFamily: "monospace",
              background: "var(--surface2)", border: "1px solid var(--green-b)",
              borderRadius: 14, padding: "14px 16px",
              wordBreak: "break-all", lineHeight: 1.8, textAlign: "left",
            }}>
              {scanned}
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn-primary" onClick={() => { onResult(scanned); handleClose(); }}>
              Use this address →
            </button>
            <button
              onClick={() => { setScanned(""); if (mode === "camera") startCamera(); }}
              style={{
                width: "100%", padding: "14px", borderRadius: 16, fontSize: 14, fontWeight: 600,
                background: "var(--surface2)", border: "1px solid var(--border2)",
                color: "var(--text2)", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Scan again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
