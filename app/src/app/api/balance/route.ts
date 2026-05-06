import { NextRequest, NextResponse } from "next/server";
import { readLimiter, checkRateLimit } from "@/lib/ratelimit";

const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DEVNET  = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const ALLOWED_NETWORKS = new Set(["mainnet-beta", "mainnet", "devnet"]);
const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(readLimiter, ip, "balance");
  if (limited) return limited;

  const wallet  = req.nextUrl.searchParams.get("wallet");
  const network = req.nextUrl.searchParams.get("network") ?? process.env.NETWORK ?? "mainnet-beta";

  if (!wallet || !SOL_PUBKEY_RE.test(wallet))
    return NextResponse.json({ sol: 0, usdc: 0, error: "Invalid wallet" }, { status: 400 });

  if (!ALLOWED_NETWORKS.has(network))
    return NextResponse.json({ sol: 0, usdc: 0, error: "Invalid network" }, { status: 400 });

  const isMainnet = network === "mainnet-beta" || network === "mainnet";
  const rpc  = isMainnet
    ? (process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com")
    : "https://api.devnet.solana.com";
  const mint = isMainnet ? USDC_MAINNET : USDC_DEVNET;

  try {
    const [solRes, tokenRes] = await Promise.all([
      fetch(rpc, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [wallet] }),
      }),
      fetch(rpc, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 2, method: "getTokenAccountsByOwner",
          params: [wallet, { mint }, { encoding: "jsonParsed" }],
        }),
      }),
    ]);

    const solData   = await solRes.json();
    const tokenData = await tokenRes.json();

    const sol  = (solData.result?.value ?? 0) / 1e9;
    const accs = tokenData.result?.value ?? [];
    const usdc = accs.length > 0
      ? (accs[0].account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0)
      : 0;

    return NextResponse.json({ sol, usdc, wallet, network: isMainnet ? "mainnet-beta" : "devnet" });
  } catch (e: any) {
    return NextResponse.json({ sol: 0, usdc: 0, error: e.message });
  }
}
