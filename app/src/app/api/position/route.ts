import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  return NextResponse.json({ summary: { balanceUsdc: 0, yieldEarned: 0 } });
}
