import { NextRequest, NextResponse } from "next/server";
import { readLimiter, checkRateLimit } from "@/lib/ratelimit";

const SOURCE  = process.env.FONBNK_SOURCE          ?? "";
const SECRET  = process.env.FONBNK_SIGNATURE_SECRET ?? "";
const SANDBOX = process.env.FONBNK_SANDBOX !== "false";

const BASE_URL     = SANDBOX ? "https://sandbox-pay.fonbnk.com" : "https://pay.fonbnk.com";
const SOL_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const COUNTRY_RE    = /^[A-Z]{2}$/;
const CURRENCY_RE   = /^[A-Z]{2,4}$/;

// HS256 JWT using built-in Web Crypto (no extra deps)
async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header   = { alg: "HS256", typ: "JWT" };
  const enc      = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const data     = `${enc(header)}.${enc(payload)}`;
  // Wrap in new Uint8Array to guarantee ArrayBuffer backing (not SharedArrayBuffer)
  const secretBuf = new Uint8Array(Buffer.from(SECRET));
  const dataBuf   = new Uint8Array(Buffer.from(data));
  const key = await crypto.subtle.importKey(
    "raw", secretBuf,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, dataBuf);
  return `${data}.${Buffer.from(sig).toString("base64url")}`;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limited = await checkRateLimit(readLimiter, ip, "fonbnk:widget");
  if (limited) return limited;

  if (!SOURCE || !SECRET)
    return NextResponse.json({ error: "Fonbnk not configured" }, { status: 503 });

  const sp            = req.nextUrl.searchParams;
  const address       = sp.get("address")      ?? "";
  const countryCode   = (sp.get("country")     ?? "").toUpperCase();
  const currencyCode  = (sp.get("currency")    ?? "").toUpperCase();

  if (!SOL_PUBKEY_RE.test(address))
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  if (!COUNTRY_RE.test(countryCode))
    return NextResponse.json({ error: "Invalid country code" }, { status: 400 });
  if (!CURRENCY_RE.test(currencyCode))
    return NextResponse.json({ error: "Invalid currency code" }, { status: 400 });

  const signature = await signJwt({ uid: crypto.randomUUID() });

  const params = new URLSearchParams({
    source:          SOURCE,
    signature,
    network:         "SOLANA",
    asset:           "USDC",
    address,
    countryIsoCode:  countryCode,
    currencyIsoCode: currencyCode,
    freezeWallet:    "true",
    hideSwitch:      "true",
    redirectUrl:     req.headers.get("origin") ?? "",
  });

  return NextResponse.json({ url: `${BASE_URL}/offramp?${params}` });
}
