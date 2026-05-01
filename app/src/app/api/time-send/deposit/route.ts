import { NextRequest, NextResponse } from "next/server";

const USDC    = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_API = "https://api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY ?? "";

export async function POST(req: NextRequest) {
  const { senderWallet, amountUsdc } = await req.json();

  if (!senderWallet || !amountUsdc)
    return NextResponse.json({ error: "senderWallet and amountUsdc required" }, { status: 400 });

  const amountRaw = Math.round(amountUsdc * 1_000_000);

  try {
    // Get Jupiter Lend deposit transaction
    const res  = await fetch(`${JUP_API}/lend/v1/earn/deposit`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body:    JSON.stringify({ asset: USDC, amount: amountRaw.toString(), signer: senderWallet }),
    });
    const data = await res.json();

    if (!res.ok || data.error || !data.transaction)
      throw new Error(data.error ?? "Jupiter Lend deposit failed — no transaction returned");

    return NextResponse.json({
      transaction:      data.transaction,   // base64 unsigned tx — client signs
      amountRaw,
      amountUsdc,
      juicedAmountRaw:  data.juicedAmountRaw ?? amountRaw, // jlUSDC units
      senderWallet,
    });
  } catch (e: any) {
    console.error("[timed-send/deposit]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
