import { NextRequest, NextResponse } from "next/server";
import { txLimiter, checkRateLimit } from "@/lib/ratelimit";

const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_API = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY ?? "";

const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_AMOUNT    = 1_000_000 * 1_000_000; // 1 M USDC in lamports

// Estimated Solana tx fee in USDC (≈0.000005 SOL at ~$84)
const ESTIMATED_FEE_RAW = Math.round(0.0004 * 1_000_000);

function getRoute(routePlan: any[]): string {
  if (!routePlan?.length) return "Jupiter Ultra";
  return routePlan.map((r: any) => r?.swapInfo?.label).filter(Boolean).join(" + ") || "Jupiter Ultra";
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(txLimiter, ip, "send");
  if (limited) return limited;

  const { senderWallet, recipientWallet, amountUsdc } = await req.json();

  if (!SOL_PUBKEY_RE.test(senderWallet))
    return NextResponse.json({ error: "Invalid senderWallet" }, { status: 400 });
  if (!SOL_PUBKEY_RE.test(recipientWallet))
    return NextResponse.json({ error: "Invalid recipientWallet" }, { status: 400 });

  const amountNum = Number(amountUsdc);
  if (!amountUsdc || !Number.isFinite(amountNum) || amountNum <= 0)
    return NextResponse.json({ error: "Invalid amountUsdc" }, { status: 400 });

  const amountRaw = Math.round(amountNum * 1_000_000);
  if (amountRaw > MAX_AMOUNT)
    return NextResponse.json({ error: "Amount exceeds maximum" }, { status: 400 });

  try {
    // ── Try Instant Boost: USDC → JupUSD → USDC via Jupiter Ultra ───────────
    let boostData: any = null;
    try {
      const boostRes = await fetch(
        `${JUP_API}/ultra/v1/order?` + new URLSearchParams({
          inputMint:         USDC,
          outputMint:        USDC,
          amount:            amountRaw.toString(),
          taker:             senderWallet,
          destinationWallet: recipientWallet,
        }),
        { headers: { "x-api-key": API_KEY } }
      );
      boostData = await boostRes.json();
    } catch {
      boostData = null;
    }

    const outAmount    = Number(boostData?.outAmount ?? 0);
    const netGainRaw   = outAmount - amountRaw - ESTIMATED_FEE_RAW;
    const isNetPositive = boostData?.transaction && outAmount > 0 && netGainRaw > 0;

    if (isNetPositive) {
      return NextResponse.json({
        strategy:    "instant_boost",
        tx:          boostData.transaction,
        requestId:   boostData.requestId,
        inAmount:    amountRaw,
        outAmount,
        netGainRaw,
        netGainUsdc: netGainRaw / 1_000_000,
        route:       getRoute(boostData.routePlan ?? []),
        message:     `Boosted! Net gain: +$${(netGainRaw / 1_000_000).toFixed(4)} USDC after fees`,
      });
    }

    // ── Fall back to direct USDC transfer (client-side SPL tx) ───────────────
    const reason = !boostData?.transaction
      ? "No boost route available"
      : `Boost net: $${(netGainRaw / 1_000_000).toFixed(4)} — not worth the fee`;

    return NextResponse.json({
      strategy:        "direct",
      amountRaw,
      mint:            USDC,
      senderWallet,
      recipientWallet,
      reason,
      message:         "Used direct route · zero spread · fees minimized",
    });

  } catch (e: any) {
    console.error("[send]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
