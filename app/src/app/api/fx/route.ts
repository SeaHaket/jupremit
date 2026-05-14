import { NextRequest, NextResponse } from "next/server";
import { readLimiter, checkRateLimit } from "@/lib/ratelimit";

const FALLBACK: Record<string, number> = {
  PHP: 61.16, IDR: 16350, VND: 25400, THB: 34.2,  MYR: 4.48,  SGD: 1.34,
  JPY: 143.5, KRW: 1370,  AUD: 1.58,  ZAR: 18.5,  NGN: 1620,  KES: 129,
  INR: 83.4,  BRL: 5.2,   GHS: 15.5,  TZS: 2620,  UGX: 3750,  RWF: 1310,
  ZMW: 27.2,  XOF: 612,   USD: 1,
};

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(readLimiter, ip, "fx");
  if (limited) return limited;

  const currency = (req.nextUrl.searchParams.get("currency") ?? "PHP").toUpperCase();
  try {
    const res  = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const rate = data.result === "success" ? data.rates[currency] : FALLBACK[currency] ?? 1;
    return NextResponse.json({ currency, rate, source: data.result === "success" ? "open.er-api.com" : "fallback" });
  } catch {
    return NextResponse.json({ currency, rate: FALLBACK[currency] ?? 1, source: "fallback" });
  }
}
