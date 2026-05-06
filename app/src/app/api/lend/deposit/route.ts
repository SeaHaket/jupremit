import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const { asset, amount, signer } = await req.json();
  if (!asset || !amount || !signer) return NextResponse.json({ error: "asset, amount, signer required" }, { status: 400 });
  try {
    const res = await fetch("https://api.jup.ag/lend/v1/earn/deposit", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.JUPITER_API_KEY ?? "" }, body: JSON.stringify({ asset, amount, signer }) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
