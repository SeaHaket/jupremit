import { NextRequest, NextResponse } from "next/server";
const FALLBACK: Record<string,number> = {PHP:61.16,IDR:16350,VND:25400,THB:34.2,MYR:4.48,SGD:1.34,JPY:143.5,KRW:1370,AUD:1.58,GBP:0.79,NGN:1620,KES:129,INR:83.4,BRL:5.2,USD:1};
export async function GET(req: NextRequest) {
  const currency = (req.nextUrl.searchParams.get("currency") ?? "PHP").toUpperCase();
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    const rate = data.result === "success" ? data.rates[currency] : FALLBACK[currency] ?? 1;
    return NextResponse.json({ currency, rate, source: data.result === "success" ? "open.er-api.com" : "fallback" });
  } catch {
    return NextResponse.json({ currency, rate: FALLBACK[currency] ?? 1, source: "fallback" });
  }
}
