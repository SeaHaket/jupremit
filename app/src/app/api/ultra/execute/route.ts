import { NextRequest, NextResponse } from "next/server";

const JUP_API = "https://api.jup.ag";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const res  = await fetch(`${JUP_API}/ultra/v1/execute`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.JUPITER_API_KEY ?? "" },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
