import { NextRequest, NextResponse } from "next/server";
import { txLimiter, checkRateLimit } from "@/lib/ratelimit";

const JUP_API = "https://api.jup.ag";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(txLimiter, ip, "ultra:execute");
  if (limited) return limited;

  const body = await req.json();

  const { signedTransaction, requestId } = body;

  if (typeof signedTransaction !== "string" || !signedTransaction)
    return NextResponse.json({ error: "signedTransaction required" }, { status: 400 });

  if (typeof requestId !== "string" || !requestId)
    return NextResponse.json({ error: "requestId required" }, { status: 400 });

  try {
    const res  = await fetch(`${JUP_API}/ultra/v1/execute`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.JUPITER_API_KEY ?? "" },
      body:    JSON.stringify({ signedTransaction, requestId }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
