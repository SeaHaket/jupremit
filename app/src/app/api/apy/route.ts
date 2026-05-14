import { NextRequest, NextResponse } from "next/server";
import { readLimiter, checkRateLimit } from "@/lib/ratelimit";

const JUPUSD_MINT = "jupyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(readLimiter, ip, "apy");
  if (limited) return limited;

  try {
    const res = await fetch("https://api.jup.ag/lend/v1/earn/tokens", {
      headers: { "x-api-key": process.env.JUPITER_API_KEY ?? "" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Lend tokens ${res.status}`);
    const data   = await res.json();
    const tokens = data.tokens ?? data ?? [];
    const juiced = tokens.find((t: any) =>
      t.mint === JUPUSD_MINT ||
      t.underlyingMint === JUPUSD_MINT ||
      t.symbol?.toLowerCase().includes("juiced")
    );
    return NextResponse.json({
      apy:    juiced?.supplyApy ?? 4.5,
      symbol: juiced?.symbol   ?? "JUICED",
      mint:   juiced?.fTokenMint ?? "",
      source: "jup.ag/lend",
    });
  } catch {
    return NextResponse.json({ apy: 4.5, source: "fallback" });
  }
}
