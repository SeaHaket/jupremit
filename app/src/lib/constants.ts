// ─── Token mints (mainnet) ────────────────────────────────────────────────────
export const MINTS = {
  USDC:   "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  JUPUSD: "jupyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  SOL:    "So11111111111111111111111111111111111111112",
} as const;

// ─── Jupiter API ──────────────────────────────────────────────────────────────
export const JUP_API = "https://api.jup.ag";

// ─── USDC decimals ────────────────────────────────────────────────────────────
export const USDC_DECIMALS = 6;
export const toUsdcLamports = (usd: number) =>
  Math.round(usd * 10 ** USDC_DECIMALS).toString();
export const fromUsdcLamports = (lamports: string | number) =>
  Number(lamports) / 10 ** USDC_DECIMALS;

// ─── Competitor fee schedule (published Apr 2026 rate cards) ─────────────────
export const COMPETITORS = {
  brightwell:   { flatFee: 8.00, fxSpread: 2.50, name: "Brightwell" },
  moneygram:    { flatFee: 5.00, fxSpread: 2.37, name: "MoneyGram"  },
  westernUnion: { flatFee: 6.99, fxSpread: 2.65, name: "Western Union" },
} as const;

// ─── Currency symbols ─────────────────────────────────────────────────────────
export const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱", IDR: "Rp", VND: "₫", THB: "฿", MYR: "RM",
  SGD: "S$", KHR: "₭", MMK: "K", JPY: "¥", KRW: "₩",
  AUD: "A$", GBP: "£", ZAR: "R", NGN: "₦", KES: "KSh",
  INR: "₹", BRL: "R$", USD: "$",
};

// ─── Offramp providers by country ────────────────────────────────────────────
export interface Provider {
  id:       string;
  name:     string;
  label:    string;  // display label
  desc:     string;
}

export const PROVIDERS_BY_COUNTRY: Record<string, Provider[]> = {
  PH: [
    { id: "coins_ph", name: "Coins.ph",      label: "Coins.ph",    desc: "USDC on Solana · converts to PHP" },
    { id: "gcash",    name: "GCash",         label: "GCash",       desc: "USDC → PHP via bridge" },
    { id: "maya",     name: "Maya",          label: "Maya",        desc: "USDC → PHP via InstaPay" },
    { id: "bank_ph",  name: "Bank transfer", label: "PH Bank",     desc: "Any PH bank via InstaPay" },
  ],
  ID: [
    { id: "gopay",    name: "GoPay",  label: "GoPay",   desc: "USDC → IDR via GoPay" },
    { id: "ovo",      name: "OVO",    label: "OVO",     desc: "USDC → IDR via OVO" },
    { id: "dana",     name: "DANA",   label: "DANA",    desc: "USDC → IDR via DANA" },
    { id: "bank_id",  name: "BCA/Mandiri", label: "BCA/Mandiri", desc: "USDC → IDR bank" },
  ],
  VN: [
    { id: "momo",     name: "MoMo",       label: "MoMo",       desc: "USDC → VND via MoMo" },
    { id: "zalopay",  name: "ZaloPay",    label: "ZaloPay",    desc: "USDC → VND via ZaloPay" },
    { id: "bank_vn",  name: "Vietcombank",label: "Vietcombank",desc: "USDC → VND bank" },
  ],
  TH: [
    { id: "promptpay",  name: "PromptPay",  label: "PromptPay",  desc: "USDC → THB via PromptPay" },
    { id: "truemoney",  name: "TrueMoney",  label: "TrueMoney",  desc: "USDC → THB via TrueMoney" },
    { id: "bank_th",    name: "SCB/Kasikorn",label: "SCB/KBank", desc: "USDC → THB bank" },
  ],
  MY: [
    { id: "tng",      name: "Touch'n Go",  label: "Touch'n Go",  desc: "USDC → MYR via TnG eWallet" },
    { id: "duitnow",  name: "DuitNow",     label: "DuitNow",     desc: "USDC → MYR via DuitNow QR" },
    { id: "bank_my",  name: "Maybank/CIMB",label: "Maybank/CIMB",desc: "USDC → MYR bank" },
  ],
  SG: [
    { id: "paynow",   name: "PayNow",  label: "PayNow",  desc: "USDC → SGD via PayNow QR" },
    { id: "grabpay",  name: "GrabPay", label: "GrabPay", desc: "USDC → SGD via GrabPay" },
    { id: "bank_sg",  name: "DBS/OCBC",label: "DBS/OCBC",desc: "USDC → SGD bank" },
  ],
  KH: [
    { id: "aba",   name: "ABA Bank",  label: "ABA Bank",  desc: "USDC → KHR/USD via ABA" },
    { id: "wing",  name: "Wing",      label: "Wing",      desc: "USDC → KHR via Wing" },
    { id: "acleda",name: "ACLEDA",    label: "ACLEDA",    desc: "USDC → KHR bank" },
  ],
  MM: [
    { id: "kbz",  name: "KBZPay",    label: "KBZPay",    desc: "USDC → MMK via KBZPay" },
    { id: "wave", name: "Wave Money", label: "Wave Money",desc: "USDC → MMK via Wave" },
  ],
  JP: [
    { id: "wise_jp",  name: "Wise",   label: "Wise", desc: "USDC → JPY via Wise" },
    { id: "paypay",   name: "PayPay", label: "PayPay", desc: "USDC → JPY via PayPay" },
    { id: "bank_jp",  name: "JP Bank",label: "JP Bank", desc: "USDC → JPY bank" },
  ],
  KR: [
    { id: "kakaopay", name: "KakaoPay", label: "KakaoPay", desc: "USDC → KRW via KakaoPay" },
    { id: "toss",     name: "Toss",     label: "Toss",     desc: "USDC → KRW via Toss" },
    { id: "bank_kr",  name: "KB/Shinhan",label: "KB/Shinhan",desc: "USDC → KRW bank" },
  ],
  AU: [
    { id: "payid",   name: "NPP PayID", label: "PayID", desc: "USDC → AUD instant bank" },
    { id: "wise_au", name: "Wise",      label: "Wise",  desc: "USDC → AUD via Wise" },
  ],
  GB: [
    { id: "fps",    name: "Faster Payments",label: "Faster Payments",desc: "USDC → GBP bank" },
    { id: "wise_gb",name: "Wise",           label: "Wise",           desc: "USDC → GBP via Wise" },
    { id: "revolut",name: "Revolut",        label: "Revolut",        desc: "USDC → GBP via Revolut" },
  ],
  US: [
    { id: "ach",    name: "ACH Bank", label: "ACH",    desc: "USDC → USD ACH bank" },
    { id: "venmo",  name: "Venmo",    label: "Venmo",  desc: "USDC → USD Venmo" },
    { id: "zelle",  name: "Zelle",    label: "Zelle",  desc: "USDC → USD Zelle instant" },
  ],
  ZA: [
    { id: "standard_bank", name: "Standard Bank", label: "Standard Bank", desc: "USDC → ZAR via Standard Bank" },
    { id: "fnb",           name: "FNB",           label: "FNB",           desc: "USDC → ZAR via FNB" },
    { id: "capitec",       name: "Capitec",       label: "Capitec",       desc: "USDC → ZAR via Capitec" },
  ],
  NG: [
    { id: "opay",        name: "OPay",        label: "OPay",       desc: "USDC → NGN via OPay" },
    { id: "flutterwave", name: "Flutterwave", label: "Flutterwave",desc: "USDC → NGN bank" },
  ],
  KE: [
    { id: "mpesa",       name: "M-Pesa",      label: "M-Pesa",     desc: "USDC → KES via M-Pesa" },
    { id: "equity_ke",   name: "Equity Bank", label: "Equity Bank",desc: "USDC → KES bank" },
  ],
  IN: [
    { id: "upi",   name: "UPI/PhonePe", label: "UPI",   desc: "USDC → INR via UPI" },
    { id: "paytm", name: "Paytm",       label: "Paytm", desc: "USDC → INR via Paytm" },
  ],
  BR: [
    { id: "pix",    name: "Pix",    label: "Pix",    desc: "USDC → BRL via Pix instant" },
    { id: "nubank", name: "Nubank", label: "Nubank", desc: "USDC → BRL via Nubank" },
  ],
  OTHER: [
    { id: "usdc_wallet", name: "USDC wallet", label: "USDC wallet", desc: "Any Solana wallet · global" },
  ],
};

// ─── Country list ─────────────────────────────────────────────────────────────
export const COUNTRIES = [
  { code: "PH", name: "Philippines",   currency: "PHP", flag: "🇵🇭", jupcard: true  },
  { code: "ID", name: "Indonesia",     currency: "IDR", flag: "🇮🇩", jupcard: false },
  { code: "VN", name: "Vietnam",       currency: "VND", flag: "🇻🇳", jupcard: true  },
  { code: "TH", name: "Thailand",      currency: "THB", flag: "🇹🇭", jupcard: true  },
  { code: "MY", name: "Malaysia",      currency: "MYR", flag: "🇲🇾", jupcard: false },
  { code: "SG", name: "Singapore",     currency: "SGD", flag: "🇸🇬", jupcard: true  },
  { code: "KH", name: "Cambodia",      currency: "KHR", flag: "🇰🇭", jupcard: true  },
  { code: "MM", name: "Myanmar",       currency: "MMK", flag: "🇲🇲", jupcard: false },
  { code: "JP", name: "Japan",         currency: "JPY", flag: "🇯🇵", jupcard: false },
  { code: "KR", name: "South Korea",   currency: "KRW", flag: "🇰🇷", jupcard: false },
  { code: "AU", name: "Australia",     currency: "AUD", flag: "🇦🇺", jupcard: false },
  { code: "GB", name: "United Kingdom",currency: "GBP", flag: "🇬🇧", jupcard: false },
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸", jupcard: false },
  { code: "NG", name: "Nigeria",       currency: "NGN", flag: "🇳🇬", jupcard: false },
  { code: "KE", name: "Kenya",         currency: "KES", flag: "🇰🇪", jupcard: false },
  { code: "IN", name: "India",         currency: "INR", flag: "🇮🇳", jupcard: false },
  { code: "BR", name: "Brazil",        currency: "BRL", flag: "🇧🇷", jupcard: false },
  { code: "OTHER", name: "Other (200+ countries)", currency: "USD", flag: "🌍", jupcard: false },
];

// ─── Fallback FX rates (Apr 29 2026 actuals) ──────────────────────────────────
export const FALLBACK_RATES: Record<string, number> = {
  PHP: 61.16, IDR: 16350, VND: 25400, THB: 34.2,
  MYR: 4.48,  SGD: 1.34,  KHR: 4080,  MMK: 2100,
  JPY: 143.5, KRW: 1370,  AUD: 1.58,  GBP: 0.79,
  ZAR: 18.5,  NGN: 1620,  KES: 129,   INR: 83.4,
  BRL: 5.2,   USD: 1,
};
