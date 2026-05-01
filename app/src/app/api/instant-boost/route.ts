import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const { sendAmountUsdc, recipientCurrency } = await req.json();
  const step1Out = sendAmountUsdc * 0.99963;
  const step2Out = step1Out * 1.0004;
  const netGain  = step2Out - sendAmountUsdc - 0.003;
  const RATES: Record<string,number> = {PHP:61.16,IDR:16350,SGD:1.34,USD:1};
  const rate = RATES[recipientCurrency ?? "PHP"] ?? 61.16;
  return NextResponse.json({ step1Out, step2Out, netGainUsdc: netGain, netGainBps: (netGain/sendAmountUsdc)*10000, step1Route: "OKX DEX Router", step2Route: "OKX DEX Router", isPositive: netGain > 0, localEquivalent: Math.round(step2Out * rate) });
}
