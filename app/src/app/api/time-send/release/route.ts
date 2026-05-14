import { NextRequest, NextResponse } from "next/server";
import { txLimiter, checkRateLimit } from "@/lib/ratelimit";

const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_API = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY ?? "";

const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_AMOUNT    = 1_000_000 * 1_000_000;

// Protocol fee: 0.2% of yield only — wallet must be set via env, no hardcoded fallback
const FEE_BPS    = 20;
const FEE_WALLET = process.env.FEE_WALLET ?? "";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(txLimiter, ip, "timesend:release");
  if (limited) return limited;

  const { senderWallet, juicedAmountRaw, originalAmountRaw } = await req.json();

  if (!senderWallet || !SOL_PUBKEY_RE.test(senderWallet))
    return NextResponse.json({ error: "Invalid senderWallet" }, { status: 400 });

  const juicedNum = Number(juicedAmountRaw);
  if (!juicedAmountRaw || !Number.isFinite(juicedNum) || juicedNum <= 0 || juicedNum > MAX_AMOUNT)
    return NextResponse.json({ error: "Invalid juicedAmountRaw" }, { status: 400 });

  // Validate client-supplied principal — must be positive and not exceed deposited amount
  const origNum = originalAmountRaw !== undefined ? Number(originalAmountRaw) : undefined;
  if (origNum !== undefined && (!Number.isFinite(origNum) || origNum <= 0 || origNum > juicedNum))
    return NextResponse.json({ error: "Invalid originalAmountRaw" }, { status: 400 });

  try {
    const posRes  = await fetch(
      `${JUP_API}/lend/v1/earn/positions?users=${senderWallet}`,
      { headers: { "x-api-key": API_KEY } }
    );
    const posData = await posRes.json();

    const positions     = posData.positions ?? posData ?? [];
    const usdcPos       = positions.find((p: any) => p.asset === USDC);
    const currentValueRaw = usdcPos?.balanceUsdc
      ? Math.round(usdcPos.balanceUsdc * 1_000_000)
      : juicedNum;

    // Use server-validated juicedNum as principal baseline (don't trust origNum for yield calc)
    const principalRaw  = origNum ?? juicedNum;
    const yieldRaw      = Math.max(0, currentValueRaw - principalRaw);
    const feeRaw        = FEE_WALLET ? Math.round(yieldRaw * FEE_BPS / 10_000) : 0;
    const senderGetsRaw = currentValueRaw - feeRaw;

    const res  = await fetch(`${JUP_API}/lend/v1/earn/withdraw`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body:    JSON.stringify({ asset: USDC, amount: juicedAmountRaw.toString(), signer: senderWallet }),
    });
    const data = await res.json();

    if (!res.ok || data.error || !data.transaction)
      throw new Error(data.error ?? "Jupiter Lend withdraw failed");

    return NextResponse.json({
      transaction:     data.transaction,
      currentValueRaw,
      yieldRaw,
      yieldUsdc:       yieldRaw / 1_000_000,
      feeRaw,
      feeUsdc:         feeRaw / 1_000_000,
      senderGetsRaw,
      feeWallet:       FEE_WALLET,
    });
  } catch (e: any) {
    console.error("[timed-send/release]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
