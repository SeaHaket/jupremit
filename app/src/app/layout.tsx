import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/components/ui/WalletProvider";

export const metadata: Metadata = {
  title:       "JupRemit — Global DeFi Remittance on Solana",
  description: "$0 fees. Mid-market rates. Earn yield in transit. Send to 12+ countries via Jupiter.",
  icons:       { icon: "/logo.svg" },
  openGraph: {
    title:       "JupRemit",
    description: "Send money anywhere in the world for almost free — DeFi remittance powered by Jupiter on Solana.",
    siteName:    "JupRemit",
  },
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor:   "#17171A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>
          <div className="phone-shell">
            <img
              aria-hidden
              src="/jupit-logo.png"
              alt=""
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center",
                opacity: 0.09, mixBlendMode: "screen",
                pointerEvents: "none", userSelect: "none", zIndex: 0,
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              {children}
            </div>
          </div>
        </WalletContextProvider>
      </body>
    </html>
  );
}
