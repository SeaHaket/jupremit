import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/components/ui/WalletProvider";

export const metadata: Metadata = {
  title:       "JupRemit — OFW Remittance on Jupiter",
  description: "$0 fees. Mid-market rates. 4.5% yield on transit. Built on Jupiter.",
  icons:       { icon: "/favicon.svg" },
  openGraph: {
    title:       "JupRemit",
    description: "Send money home for almost free — DeFi remittance for OFWs",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>
          <div className="phone-shell">
            {children}
          </div>
        </WalletContextProvider>
      </body>
    </html>
  );
}
