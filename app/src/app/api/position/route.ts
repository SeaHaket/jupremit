import { NextRequest, NextResponse } from "next/server";

const JUP_API = "https://api.jup.ag";
const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

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
