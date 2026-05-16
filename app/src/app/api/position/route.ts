import { NextRequest, NextResponse } from "next/server";
import { readLimiter, checkRateLimit } from "@/lib/ratelimit";

const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_API = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY ?? "";
const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(readLimiter, ip, "position");
  if (limited) return limited;

  const wallet = req.nextUrl.searchParams.get("wallet") ?? "";
  if (!SOL_PUBKEY_RE.test(wallet))
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

  try {
    const res  = await fetch(
      `${JUP_API}/lend/v1/earn/positions?users=${wallet}`,
      { headers: { "x-api-key": API_KEY }, next: { revalidate: 0 } }
    );
    const data = await res.json();
    const positions: any[] = data.positions ?? data ?? [];
    const pos = positions.find((p: any) => p.asset === USDC || p.mint === USDC);

    const balanceUsdc  = pos ? Number(pos.assets ?? pos.balance ?? "0") / 1_000_000 : 0;
    const yieldEarned  = pos ? Number(pos.earnings ?? "0") / 1_000_000 : 0;

    return NextResponse.json({ balanceUsdc, yieldEarned, hasPosition: balanceUsdc > 0 });
  } catch {
    return NextResponse.json({ balanceUsdc: 0, yieldEarned: 0, hasPosition: false });
  }
}
