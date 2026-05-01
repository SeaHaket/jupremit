import { NextRequest, NextResponse } from "next/server";

const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUPUSD  = "jupyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const JUP_API = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY ?? "";

// Estimated Solana tx fee in USDC (≈0.000005 SOL at ~$84)
const ESTIMATED_FEE_USDC = 0.0004;
const ESTIMATED_FEE_RAW  = Math.round(ESTIMATED_FEE_USDC * 1_000_000);

function getRoute(routePlan: any[]): string {
  if (!routePlan?.length) return "Jupiter Ultra";
  return routePlan.map((r: any) => r?.swapInfo?.label).filter(Boolean).join(" + ") || "Jupiter Ultra";
}

export async function POST(req: NextRequest) {
  const { senderWallet, recipientWallet, amountUsdc } = await req.json();

  if (!senderWallet || !recipientWallet || !amountUsdc)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const amountRaw = Math.round(amountUsdc * 1_000_000);

  try {
    // ── Try Instant Boost: USDC → JupUSD → USDC in one Jupiter Ultra order ──
    // We use a two-hop swap: USDC → JupUSD → USDC
    // Jupiter Ultra handles this atomically in one transaction
    // destinationWallet sends the output directly to recipient
    let boostData: any = null;

    try {
      const boostRes = await fetch(
        `${JUP_API}/ultra/v1/order?` + new URLSearchParams({
          inputMint:         USDC,
          outputMint:        USDC,
          amount:            amountRaw.toString(),
          taker:             senderWallet,
          destinationWallet: recipientWallet,
          // Route through JupUSD as intermediate for the spread capture
          // Jupiter will find optimal path — may or may not use JupUSD
        }),
        { headers: { "x-api-key": API_KEY } }
      );
      boostData = await boostRes.json();
    } catch {
      boostData = null;
    }

    // ── Evaluate if boost is net positive after fees ──────────────────────────
    const outAmount  = parseInt(boostData?.outAmount ?? "0");
    const netGainRaw = outAmount - amountRaw - ESTIMATED_FEE_RAW;
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

    // ── Fall back to direct USDC transfer (one SPL tx, client-side) ──────────
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
