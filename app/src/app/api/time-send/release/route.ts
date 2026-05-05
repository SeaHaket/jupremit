import { NextRequest, NextResponse } from "next/server";

const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_API = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY ?? "";

// Protocol fee: 0.2% of yield only
const FEE_BPS = 20;
const FEE_WALLET = "H6U2xdKTvUUNkbBWFwZdUJCCHSniPeChG4ZUE1zZHoxvQ";

export async function POST(req: NextRequest) {
  const { senderWallet, juicedAmountRaw, originalAmountRaw } = await req.json();

  if (!senderWallet || !juicedAmountRaw)
    return NextResponse.json({ error: "senderWallet and juicedAmountRaw required" }, { status: 400 });

  try {
    // Get current position to know exact USDC value of jlUSDC
    const posRes  = await fetch(
      `${JUP_API}/lend/v1/earn/positions?users=${senderWallet}`,
      { headers: { "x-api-key": API_KEY } }
    );
    const posData = await posRes.json();

    // Find USDC position
    const positions = posData.positions ?? posData ?? [];
    const usdcPos   = positions.find((p: any) => p.asset === USDC);

    // Estimate current value (Jupiter Lend will give exact on withdraw)
    const currentValueRaw = usdcPos?.balanceUsdc
      ? Math.round(usdcPos.balanceUsdc * 1_000_000)
      : juicedAmountRaw;

    // Calculate yield and fee
    const yieldRaw      = Math.max(0, currentValueRaw - (originalAmountRaw ?? juicedAmountRaw));
    const feeRaw        = Math.round(yieldRaw * FEE_BPS / 10_000);
    const senderGetsRaw = currentValueRaw - feeRaw;

    // Build Jupiter Lend withdraw tx — withdraws to sender wallet
    const res  = await fetch(`${JUP_API}/lend/v1/earn/withdraw`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body:    JSON.stringify({
        asset:  USDC,
        amount: juicedAmountRaw.toString(),
        signer: senderWallet,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.error || !data.transaction)
      throw new Error(data.error ?? "Jupiter Lend withdraw failed");

    return NextResponse.json({
      transaction:     data.transaction,  // client signs — withdraws USDC to sender
      currentValueRaw,
      yieldRaw,
      yieldUsdc:       yieldRaw / 1_000_000,
      feeRaw,
      feeUsdc:         feeRaw / 1_000_000,
      senderGetsRaw,   // sender gets this, then sends to recipient via SPL transfer
      feeWallet:       FEE_WALLET,
    });
  } catch (e: any) {
    console.error("[timed-send/release]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
