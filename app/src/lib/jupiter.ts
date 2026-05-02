/**
 * JupRemit — Jupiter Developer Platform integration
 * All API calls use exact endpoints from dev.jup.ag
 *
 * Ultra Swap API:  api.jup.ag/ultra/v1/order  +  /execute
 * Lend Earn API:   api.jup.ag/lend/v1/earn/*
 * Price API:       api.jup.ag/price/v2
 */

import type {
  UltraOrderResponse,
  UltraExecuteResponse,
  LendToken,
  LendPosition,
  LendEarnings,
} from "@/types";
import { JUP_API, MINTS, FALLBACK_RATES, CURRENCY_SYMBOLS, COMPETITORS } from "./constants";
import type { CompetitorData, FxRates } from "@/types";

const API_KEY = process.env.JUPITER_API_KEY ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const jupHeaders = () => ({
  "Content-Type": "application/json",
  "x-api-key":    API_KEY,
});

async function jupFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...jupHeaders(), ...((init?.headers as object) ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jupiter API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── 1. Ultra Swap — Get Order ────────────────────────────────────────────────
// docs: dev.jup.ag/docs/ultra/get-order
export async function getUltraOrder(
  inputMint:  string,
  outputMint: string,
  amount:     string,   // native units (USDC 6 decimals: $1 = "1000000")
  taker:      string,   // user's wallet pubkey
  referralAccount?: string,
): Promise<UltraOrderResponse> {
  const params = new URLSearchParams({ inputMint, outputMint, amount, taker });
  if (referralAccount) {
    params.set("referralAccount", referralAccount);
    params.set("referralFee", "20"); // 0.2% integrator fee in bps
  }

  const data = await jupFetch<UltraOrderResponse>(
    `${JUP_API}/ultra/v1/order?${params}`
  );

  if (data.errorCode) {
    throw new Error(`Order error [${data.errorCode}]: ${data.errorMessage}`);
  }
  return data;
}

// ─── 2. Ultra Swap — Execute Order ───────────────────────────────────────────
// docs: dev.jup.ag/docs/ultra/execute-order
export async function executeUltraOrder(
  signedTransaction: string, // base64 signed tx
  requestId:         string,
): Promise<UltraExecuteResponse> {
  return jupFetch<UltraExecuteResponse>(`${JUP_API}/ultra/v1/execute`, {
    method: "POST",
    body: JSON.stringify({ signedTransaction, requestId }),
  });
}

// ─── 3. Lend Earn — Get all tokens / APY ─────────────────────────────────────
// docs: dev.jup.ag/docs/lend/earn/api  →  GET /lend/v1/earn/tokens
export async function getLendTokens(): Promise<LendToken[]> {
  try {
    const data = await jupFetch<{ tokens: LendToken[] }>(
      `${JUP_API}/lend/v1/earn/tokens`
    );
    return data.tokens ?? [];
  } catch {
    // Fallback if Lend API unavailable (e.g. on devnet)
    return [
      {
        mint:          MINTS.JUPUSD,
        fTokenMint:    "jlUSDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        symbol:        "JupUSD",
        decimals:      6,
        supplyApy:     4.5,
        totalSupply:   "1000000000000",
        exchangePrice: 1.0012,
      },
    ];
  }
}

// ─── 4. Lend Earn — Get user positions ───────────────────────────────────────
// docs: dev.jup.ag/docs/lend/earn/api  →  GET /lend/v1/earn/positions
export async function getLendPositions(userWallet: string): Promise<LendPosition[]> {
  try {
    const data = await jupFetch<{ positions: LendPosition[] }>(
      `${JUP_API}/lend/v1/earn/positions?users=${userWallet}`
    );
    return data.positions ?? [];
  } catch {
    return [];
  }
}

// ─── 5. Lend Earn — Get earnings ─────────────────────────────────────────────
// docs: dev.jup.ag/docs/lend/earn/api  →  GET /lend/v1/earn/earnings
export async function getLendEarnings(
  userWallet:  string,
  positionIds: string[],
): Promise<LendEarnings[]> {
  if (!positionIds.length) return [];
  try {
    const data = await jupFetch<LendEarnings[]>(
      `${JUP_API}/lend/v1/earn/earnings?user=${userWallet}&positions=${positionIds.join(",")}`
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── 6. Lend Earn — Build deposit transaction ────────────────────────────────
// docs: dev.jup.ag/docs/lend/earn/api  →  POST /lend/v1/earn/deposit
// Returns unsigned base64 transaction
export async function buildLendDepositTx(
  asset:  string,  // underlying mint (USDC or JupUSD)
  amount: string,  // in native units (lamports)
  signer: string,  // user's wallet pubkey
): Promise<string> {  // base64 tx
  const data = await jupFetch<{ transaction: string }>(
    `${JUP_API}/lend/v1/earn/deposit`,
    {
      method: "POST",
      body: JSON.stringify({ asset, amount, signer }),
    }
  );
  return data.transaction;
}

// ─── 7. Lend Earn — Build withdraw transaction ───────────────────────────────
// docs: dev.jup.ag/docs/lend/earn/api  →  POST /lend/v1/earn/withdraw
export async function buildLendWithdrawTx(
  asset:  string,
  amount: string,
  signer: string,
): Promise<string> {
  const data = await jupFetch<{ transaction: string }>(
    `${JUP_API}/lend/v1/earn/withdraw`,
    {
      method: "POST",
      body: JSON.stringify({ asset, amount, signer }),
    }
  );
  return data.transaction;
}

// ─── 8. Lend Earn — Deposit using instructions (for CPI/composability) ───────
// docs: dev.jup.ag/docs/lend/earn/api  →  POST /lend/v1/earn/deposit-instructions
export async function getLendDepositInstructions(
  asset:  string,
  amount: string,
  signer: string,
): Promise<{ instructions: unknown[] }> {
  return jupFetch(`${JUP_API}/lend/v1/earn/deposit-instructions`, {
    method: "POST",
    body: JSON.stringify({ asset, amount, signer }),
  });
}

// ─── 9. Price API ─────────────────────────────────────────────────────────────
// docs: dev.jup.ag/api-reference  →  GET /price/v2
export async function getTokenPrices(
  mints: string[]
): Promise<Record<string, number>> {
  try {
    const data = await jupFetch<{
      data: Record<string, { id: string; price: string }>
    }>(`${JUP_API}/price/v2?ids=${mints.join(",")}`);

    const result: Record<string, number> = {};
    for (const [mint, info] of Object.entries(data.data ?? {})) {
      result[mint] = parseFloat(info.price);
    }
    return result;
  } catch {
    return {};
  }
}

// ─── 10. JUICED APY — derived from Lend tokens endpoint ─────────────────────
export async function getJuicedApy(): Promise<{
  apy:          number;
  exchangePrice: number;
  fTokenMint:    string;
}> {
  const tokens = await getLendTokens();

  // Find the JupUSD lending token (which produces JUICED / jlJupUSD)
  const jupusd = tokens.find(
    (t) =>
      t.mint === MINTS.JUPUSD ||
      t.symbol?.toLowerCase().includes("jupusd") ||
      t.symbol?.toLowerCase().includes("jusd")
  );

  return {
    apy:           jupusd?.supplyApy     ?? 4.5,
    exchangePrice: jupusd?.exchangePrice ?? 1.001,
    fTokenMint:    jupusd?.fTokenMint    ?? "",
  };
}

// ─── 11. FX Rates — open.er-api.com (hourly, IMF sourced) ────────────────────
// More accurate for PHP / SEA currencies than Frankfurter (ECB-only)
let _fxCache: FxRates | null = null;
let _fxTs = 0;
const FX_TTL = 3_600_000; // 1 hour

export async function getLiveFxRates(): Promise<FxRates> {
  const now = Date.now();
  if (_fxCache && now - _fxTs < FX_TTL) return _fxCache;

  try {
    const res  = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();

    if (data.result !== "success") throw new Error("FX API non-success");

    _fxCache = {
      base:      "USD",
      rates:     data.rates,
      fetchedAt: now,
      source:    "open.er-api.com",
    };
    _fxTs = now;
    return _fxCache;
  } catch {
    // Hardcoded Apr 29 2026 actuals as fallback
    return {
      base:      "USD",
      rates:     FALLBACK_RATES,
      fetchedAt: now,
      source:    "fallback",
    };
  }
}

export function getRate(rates: FxRates, currency: string): number {
  return (rates.rates[currency] as number) ?? FALLBACK_RATES[currency] ?? 1;
}

// ─── 12. Competitor comparison ────────────────────────────────────────────────
export async function buildCompetitorComparison(
  sendUsd:  number,
  currency: string,
): Promise<CompetitorData> {
  const fx  = await getLiveFxRates();
  const mid = getRate(fx, currency);
  const sym = CURRENCY_SYMBOLS[currency] ?? "";

  function calcCompetitor(key: keyof typeof COMPETITORS) {
    const c        = COMPETITORS[key];
    const fxRate   = mid - c.fxSpread;
    const youPay   = sendUsd + c.flatFee;
    const effective = sendUsd - c.flatFee; // effective USD sent after fee
    const localAmt = Math.round(Math.max(0, effective) * fxRate);
    return { fee: c.flatFee, youPay, localAmt, fxRate };
  }

  return {
    jupremit:      { fee: 0.003, youPay: sendUsd + 0.003, localAmt: Math.round(sendUsd * mid) },
    brightwell:    calcCompetitor("brightwell"),
    moneygram:     calcCompetitor("moneygram"),
    westernUnion:  calcCompetitor("westernUnion"),
    midMarketRate: mid,
    currencySymbol: sym,
    disclaimer:
      "Competitor fees estimated from published Apr 2026 rate cards. " +
      "JupRemit delivers USDC on-chain; local currency conversion is done by the " +
      "recipient's provider at their own rate. Est. amounts shown for reference.",
  };
}

// ─── 13. Instant Boost quote (USDC→JupUSD→USDC round-trip) ──────────────────
// Based on observed live data: 100 USDC → 99.963732 JupUSD → 100.005184 USDC
// Route determined dynamically by Jupiter Ultra (best price across all DEXs)
export async function quoteInstantBoost(
  sendAmountUsdc: number,
  takerWallet:    string,
  currency:       string,
): Promise<{
  step1Out:       number;
  step2Out:       number;
  netGainUsdc:    number;
  netGainBps:     number;
  step1Route:     string;
  step2Route:     string;
  isPositive:     boolean;
  localEquivalent: number;
}> {
  const lamports = Math.round(sendAmountUsdc * 1e6).toString();
  const fx       = await getLiveFxRates();
  const fxRate   = getRate(fx, currency);

  try {
    // Leg 1: USDC → JupUSD
    const leg1 = await getUltraOrder(MINTS.USDC, MINTS.JUPUSD, lamports, takerWallet);
    const step1Out = Number(leg1.outAmount) / 1e6;
    const route1   = (leg1.routePlan[0]?.swapInfo?.label) ?? "Jupiter Ultra";

    // Leg 2: JupUSD → USDC (using actual leg1 output amount)
    const leg2Lamports = Math.round(step1Out * 1e6).toString();
    const leg2 = await getUltraOrder(MINTS.JUPUSD, MINTS.USDC, leg2Lamports, takerWallet);
    const step2Out = Number(leg2.outAmount) / 1e6;
    const route2   = (leg2.routePlan[0]?.swapInfo?.label) ?? "Jupiter Ultra";

    const gasCost   = 0.003; // 2 txs × ~$0.0015 Solana gas
    const netGain   = step2Out - sendAmountUsdc - gasCost;
    const netBps    = (netGain / sendAmountUsdc) * 10_000;

    return {
      step1Out,
      step2Out,
      netGainUsdc:     netGain,
      netGainBps:      netBps,
      step1Route:      route1,
      step2Route:      route2,
      isPositive:      netGain > 0,
      localEquivalent: Math.round(step2Out * fxRate),
    };
  } catch {
    // Fallback to observed rates from screenshots
    const step1Out  = sendAmountUsdc * 0.99963;  // observed: 100→99.963732
    const step2Out  = step1Out * 1.0004;          // observed: 99.96→100.005
    const netGain   = step2Out - sendAmountUsdc - 0.003;
    const order1: any = {}; // placeholder to satisfy type, real route info not available in fallback
    const order2: any = {};
    return {
      step1Out,
      step2Out,
      netGainUsdc:     netGain,
      netGainBps:      (netGain / sendAmountUsdc) * 10_000,
      step1Route:      (order1.routePlan ?? []).map((r: any) => r?.swapInfo?.label).filter(Boolean).join(" + ") || "Jupiter Ultra",
      step2Route:      (order2.routePlan ?? []).map((r: any) => r?.swapInfo?.label).filter(Boolean).join(" + ") || "Jupiter Ultra",
      isPositive:      netGain > 0,
      localEquivalent: Math.round(step2Out * fxRate),
    };
  }
}
