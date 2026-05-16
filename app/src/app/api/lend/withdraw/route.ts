import { NextRequest, NextResponse } from "next/server";
import { txLimiter, checkRateLimit } from "@/lib/ratelimit";

const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_API = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY ?? "";
const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(txLimiter, ip, "lend:withdraw");
  if (limited) return limited;

  const { amountUsdc, signer } = await req.json();

  if (!signer || !SOL_PUBKEY_RE.test(signer))
    return NextResponse.json({ error: "Invalid signer" }, { status: 400 });

  const amountNum = Number(amountUsdc);
  if (!Number.isFinite(amountNum) || amountNum <= 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const amountRaw = Math.round(amountNum * 1_000_000);

  try {
    const res  = await fetch(`${JUP_API}/lend/v1/earn/withdraw`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body:    JSON.stringify({ asset: USDC, amount: amountRaw.toString(), signer }),
    });
    const data = await res.json();
    if (!res.ok || !data.transaction)
      throw new Error(data.error ?? "Jupiter Lend withdraw failed");
    return NextResponse.json({ transaction: data.transaction, amountRaw });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
