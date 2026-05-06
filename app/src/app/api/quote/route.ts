import { NextRequest, NextResponse } from "next/server";

const USDC   = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUPUSD = "jupyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const JUP    = "https://api.jup.ag";
const KEY    = process.env.JUPITER_API_KEY ?? "";

function getRoute(routePlan: any[]): string {
  if (!routePlan?.length) return "Jupiter Ultra";
  const labels = routePlan.map(r => r?.swapInfo?.label).filter(Boolean);
  return labels.length ? labels.join(" + ") : "Jupiter Ultra";
}

export async function GET(req: NextRequest) {
  const amount   = parseFloat(req.nextUrl.searchParams.get("amount")   ?? "100");
  const currency = req.nextUrl.searchParams.get("currency") ?? "PHP";
  const holdDays = parseInt(req.nextUrl.searchParams.get("holdDays")   ?? "3");
  const amountRaw = Math.round(amount * 1_000_000);

  // Fallback FX rates
  const RATES: Record<string, number> = {
    PHP: 61.16, IDR: 16350, VND: 25400, THB: 34.2,
    MYR: 4.48,  SGD: 1.34,  ZAR: 18.5,  GBP: 0.79,
    NGN: 1620,  KES: 129,   INR: 83.4,  BRL: 5.2,
    JPY: 143.5, KRW: 1370,  USD: 1,
  };

  // Fetch live FX
  let rate = RATES[currency] ?? 61.16;
  try {
    const fxRes  = await fetch(`https://open.er-api.com/v6/latest/USD`);
    const fxData = await fxRes.json();
    if (fxData.result === "success") rate = fxData.rates[currency] ?? rate;
  } catch {}

  // Fetch live APY
  let apy = 4.5;
  try {
    const apyRes  = await fetch(`${JUP}/lend/v1/earn/tokens`, { headers: { "x-api-key": KEY } });
    const apyData = await apyRes.json();
    const tokens  = apyData.tokens ?? apyData ?? [];
    const juiced  = tokens.find((t: any) =>
      t.mint === JUPUSD || t.symbol?.toLowerCase().includes("jl")
    );
    if (juiced?.supplyApy) apy = juiced.supplyApy;
  } catch {}

  // Fetch LIVE Jupiter Ultra quotes for Instant Boost
  let step1Out   = amountRaw * 0.99963;
  let step2Out   = step1Out  * 1.0004;
  let step1Route = "Jupiter Ultra";
  let step2Route = "Jupiter Ultra";

  try {
    const [q1Res, q2Res] = await Promise.all([
      fetch(`${JUP}/ultra/v1/order?` + new URLSearchParams({
        inputMint: USDC, outputMint: JUPUSD,
        amount: amountRaw.toString(), taker: "11111111111111111111111111111111",
      }), { headers: { "x-api-key": KEY } }),
      fetch(`${JUP}/ultra/v1/order?` + new URLSearchParams({
        inputMint: JUPUSD, outputMint: USDC,
        amount: Math.round(amountRaw * 0.99963).toString(),
        taker: "11111111111111111111111111111111",
      }), { headers: { "x-api-key": KEY } }),
    ]);

    const q1 = await q1Res.json();
    const q2 = await q2Res.json();

    if (q1.outAmount)   step1Out   = Number(q1.outAmount);
    if (q2.outAmount)   step2Out   = Number(q2.outAmount);
    if (q1.routePlan)   step1Route = getRoute(q1.routePlan);
    if (q2.routePlan)   step2Route = getRoute(q2.routePlan);
  } catch {}

  const netGainUsdc   = (step2Out - amountRaw) / 1_000_000;
  const step1OutUsdc  = step1Out / 1_000_000;
  const step2OutUsdc  = step2Out / 1_000_000;
  const transitNet    = amount * (apy / 100) * (holdDays / 365) - 0.006;

  const SYMS: Record<string,string> = {
    PHP:"₱",IDR:"Rp",VND:"₫",THB:"฿",MYR:"RM",SGD:"S$",ZAR:"R",
    NGN:"₦",KES:"KSh",INR:"₹",BRL:"R$",GBP:"£",JPY:"¥",KRW:"₩",USD:"$",
  };
  const sym = SYMS[currency] ?? "$";

  return NextResponse.json({
    instantBoost: {
      step1Out:     step1OutUsdc,
      step2Out:     step2OutUsdc,
      netGainUsdc,
      netGainBps:   (netGainUsdc / amount) * 10_000,
      step1Route,
      step2Route,
      isPositive:   netGainUsdc > 0,
      localEquivalent: Math.round(step2OutUsdc * rate),
    },
    transitYield: {
      apy,
      holdDays,
      netGain:      transitNet,
      localEquivalent: Math.round((amount + transitNet) * rate),
    },
    competitors: {
      jupremit:     { fee: 0.003, localAmt: Math.round(amount * rate) },
      brightwell:   { fee: 8,     localAmt: Math.round((amount - 8)   * (rate * 0.96)) },
      moneygram:    { fee: 5,     localAmt: Math.round((amount - 5)   * (rate * 0.961)) },
      westernUnion: { fee: 6.99,  localAmt: Math.round((amount - 6.99) * (rate * 0.957)) },
      currencySymbol: sym,
      disclaimer: "Est. from Apr 2026 published rate cards.",
    },
    recommended:    transitNet > netGainUsdc && amount >= 300 ? "transit_yield" : "instant_boost",
    midMarketRate:  rate,
    currency,
    liveRoutes:     { step1: step1Route, step2: step2Route },
  });
}
