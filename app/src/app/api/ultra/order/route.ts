import { NextRequest, NextResponse } from "next/server";

const JUP_API = "https://api.jup.ag";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams.toString();
  try {
    const res  = await fetch(`${JUP_API}/ultra/v1/order?${params}`, {
      headers: { "x-api-key": process.env.JUPITER_API_KEY ?? "" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
