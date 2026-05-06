import { NextRequest, NextResponse } from "next/server";
import { readLimiter, checkRateLimit } from "@/lib/ratelimit";

const JUP_API = "https://api.jup.ag";
const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(readLimiter, ip, "position");
  if (limited) return limited;

  const wallet = req.nextUrl.searchParams.get("wallet");

  if (!wallet || !SOL_PUBKEY_RE.test(wallet))
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

  try {
    const res = await fetch(
      `${JUP_API}/lend/v1/earn/positions?users=${wallet}`,
      { headers: { "x-api-key": process.env.JUPITER_API_KEY ?? "" } }
    );
    if (!res.ok) throw new Error(`Lend API ${res.status}`);
    const data      = await res.json();
    const positions = data.positions ?? data ?? [];
    const usdcPos   = positions.find((p: any) => p.asset === USDC || p.mint === USDC);

    return NextResponse.json({
      positions,
      summary: {
        balanceUsdc: usdcPos?.balanceUsdc ?? usdcPos?.balance ?? 0,
        yieldEarned: usdcPos?.yieldEarned ?? 0,
      },
    });
  } catch {
    return NextResponse.json({ positions: [], summary: { balanceUsdc: 0, yieldEarned: 0 } });
  }
}
