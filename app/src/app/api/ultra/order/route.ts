import { NextRequest, NextResponse } from "next/server";
import { txLimiter, checkRateLimit } from "@/lib/ratelimit";

const JUP_API = "https://api.jup.ag";

const ALLOWED_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "jupyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  // JupUSD
]);

const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_AMOUNT    = 1_000_000 * 1_000_000; // 1M USDC in lamports

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(txLimiter, ip, "ultra:order");
  if (limited) return limited;

  const sp = req.nextUrl.searchParams;

  const inputMint  = sp.get("inputMint")  ?? "";
  const outputMint = sp.get("outputMint") ?? "";
  const amount     = sp.get("amount")     ?? "";
  const taker      = sp.get("taker")      ?? "";

  if (!ALLOWED_MINTS.has(inputMint) || !ALLOWED_MINTS.has(outputMint))
    return NextResponse.json({ error: "Invalid mint" }, { status: 400 });

  if (!SOL_PUBKEY_RE.test(taker))
    return NextResponse.json({ error: "Invalid taker" }, { status: 400 });

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > MAX_AMOUNT)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const params = new URLSearchParams({ inputMint, outputMint, amount, taker });

  // Optional: referral (whitelist only known referral accounts)
  const referralAccount = sp.get("referralAccount");
  const referralFee     = sp.get("referralFee");
  if (referralAccount && SOL_PUBKEY_RE.test(referralAccount)) {
    params.set("referralAccount", referralAccount);
    if (referralFee) {
      const refFeeNum = parseInt(referralFee, 10);
      if (Number.isFinite(refFeeNum) && refFeeNum >= 0 && refFeeNum <= 500)
        params.set("referralFee", String(refFeeNum));
    }
  }

  try {
    const res  = await fetch(`${JUP_API}/ultra/v1/order?${params}`, {
      headers: { "x-api-key": process.env.JUPITER_API_KEY ?? "" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
