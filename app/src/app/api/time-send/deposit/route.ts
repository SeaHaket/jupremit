import { NextRequest, NextResponse } from "next/server";
import { txLimiter, checkRateLimit } from "@/lib/ratelimit";

const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_API = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY ?? "";

const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_AMOUNT    = 1_000_000 * 1_000_000; // 1 M USDC in lamports

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(txLimiter, ip, "timesend:deposit");
  if (limited) return limited;

  const { senderWallet, amountUsdc } = await req.json();

  if (!senderWallet || !SOL_PUBKEY_RE.test(senderWallet))
    return NextResponse.json({ error: "Invalid senderWallet" }, { status: 400 });

  const amountNum = Number(amountUsdc);
  if (!amountUsdc || !Number.isFinite(amountNum) || amountNum <= 0)
    return NextResponse.json({ error: "Invalid amountUsdc" }, { status: 400 });

  const amountRaw = Math.round(amountNum * 1_000_000);
  if (amountRaw > MAX_AMOUNT)
    return NextResponse.json({ error: "Amount exceeds maximum" }, { status: 400 });

  try {
    const res  = await fetch(`${JUP_API}/lend/v1/earn/deposit`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body:    JSON.stringify({ asset: USDC, amount: amountRaw.toString(), signer: senderWallet }),
    });
    const data = await res.json();

    if (!res.ok || data.error || !data.transaction)
      throw new Error(data.error ?? "Jupiter Lend deposit failed — no transaction returned");

    return NextResponse.json({
      transaction:     data.transaction,
      amountRaw,
      amountUsdc:      amountNum,
      juicedAmountRaw: data.juicedAmountRaw ?? amountRaw,
      senderWallet,
    });
  } catch (e: any) {
    console.error("[timed-send/deposit]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
