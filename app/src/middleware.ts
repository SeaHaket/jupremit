import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://jupremit.vercel.app";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  const origin   = req.headers.get("origin");
  const response = NextResponse.next();

  // Reflect origin only if it matches the deployed app (or is same-origin / no origin)
  const allowed = !origin || origin === ALLOWED_ORIGIN || origin.startsWith("http://localhost");
  response.headers.set("Access-Control-Allow-Origin", allowed ? (origin ?? ALLOWED_ORIGIN) : "null");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  // Reject cross-origin POST requests from unknown origins
  if (req.method === "POST" && !allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: response.headers });
  }

  return response;
}

export const config = { matcher: "/api/:path*" };
