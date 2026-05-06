import { NextRequest, NextResponse } from "next/server";
import { txLimiter, checkRateLimit } from "@/lib/ratelimit";

const ALLOWED_ASSETS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "jupyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  // JupUSD
]);
const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_AMOUNT    = 1_000_000 * 1_000_000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(txLimiter, ip, "lend:withdraw");
  if (limited) return limited;

  const { asset, amount, signer } = await req.json();

  if (!ALLOWED_ASSETS.has(asset))
    return NextResponse.json({ error: "Invalid asset" }, { status: 400 });

  if (!signer || !SOL_PUBKEY_RE.test(signer))
    return NextResponse.json({ error: "Invalid signer" }, { status: 400 });

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > MAX_AMOUNT)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  try {
    const res = await fetch("https://api.jup.ag/lend/v1/earn/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.JUPITER_API_KEY ?? "" },
      body: JSON.stringify({ asset, amount: amountNum.toString(), signer }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
