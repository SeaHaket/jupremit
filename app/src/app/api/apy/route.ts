import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res  = await fetch("https://api.jup.ag/lend/v1/earn/tokens", {
      headers: { "x-api-key": process.env.JUPITER_API_KEY ?? "" },
      next: { revalidate: 300 }, // cache 5 min
    });
    const data = await res.json();
    const tokens = data.tokens ?? data ?? [];
    const juiced = tokens.find((t: any) =>
      t.symbol?.toLowerCase().includes("jl") ||
      t.symbol?.toLowerCase().includes("juiced") ||
      t.mint === "jupyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
    );
    return NextResponse.json({
      apy:    juiced?.supplyApy ?? 4.5,
      symbol: juiced?.symbol ?? "JUICED",
      mint:   juiced?.fTokenMint ?? "",
      source: "jup.ag/lend",
    });
  } catch {
    return NextResponse.json({ apy: 4.5, source: "fallback" });
  }
}
