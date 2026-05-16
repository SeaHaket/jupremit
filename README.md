# JupRemit (PasaPay)

> **The only remittance dApp that gives you yield instead of eating your hard earned money.**

Built by a seafarer, for seafarers and OFWs everywhere.

---

## The Problem — From Someone Who Lives It

I am a seafarer. Every month, I open the Brightwell app to send money home to my family in the Philippines. And every single time, I watch the same thing happen — the fees kick in, the FX rate cuts another slice, and by the time the money lands in my family's account, a meaningful chunk of what I worked hard for at sea is just gone. Not sent home. Gone.

**$8 flat fee. A FX spread that shaves another 4% off. You pay $108 to send $100.**

I started building JupRemit because I got tired of accepting that. Every OFW and seafarer I know has the same story. We work months away from our families on ships, on construction sites, in hospitals abroad — and the remittance industry's answer is to charge us for the privilege of sending money home.

DeFi changed what's possible. Jupiter changed what's buildable. JupRemit is the result.

---

## The Bigger Picture — Why This Matters Beyond Remittance

Seafarers don't just send money home. We live on ships for months at a time with paycards in our pockets — and right now those cards are only good for ATM withdrawals and basic purchases when we hit port.

Meanwhile, crypto cards are proliferating everywhere. Most of them are riding the memecoin wave — here today, gone when the market turns. The projects that survive will be the ones that found real users with real needs.

**JupRemit is designed to be that bridge.** Not another product for crypto natives — a product for the 1.9 million seafarers and 281 million migrant workers who already have a financial problem that DeFi can actually solve.

The unlock goes further than remittance:

- **Idle cash earns yield** — money sitting between pay periods earns 4.5% APY in JUICED instead of earning nothing in a Brightwell account
- **JupCard as everyday spending** — seafarers already use paycards to buy goods at port. JupCard positioned as the remittance card naturally becomes the spending card, with cashback that traditional paycards don't offer
- **Distribution nobody has touched** — the crypto industry has spent years trying to get normal people to use DeFi. Seafarers are a captive, underserved, financially motivated audience that nobody has built for specifically

This is what positions Jupiter differently from every other DeFi protocol chasing the same crypto-native users. JupRemit is the front door for people who have never used a DEX, don't know what a liquidity pool is, and don't care — they just want to stop losing money every time they call home.

---

## What JupRemit Does

JupRemit is a **non-custodial DeFi remittance dApp** built entirely on Jupiter's Developer Platform. The app UI is branded **PasaPay** — a name chosen to feel familiar and accessible to OFW families, not intimidating like "crypto" or "DeFi." Under the hood it's all Jupiter.

**The money flow starts with JupCard.** A seafarer either sets JupCard as the direct deposit receiver of their salary, or manually sends from their existing paycard (Brightwell, etc.) to JupCard via ACH. Once the USDC is in JupCard, PasaPay reads the balance and the user decides what to do: remit the full amount immediately, save a portion in the Vault while sending the rest, or hold everything and earn yield before releasing it to the family.

It lets OFWs and seafarers send USDC home to their families with:

- **$0.003 in fees** (Solana gas only — no platform fee, no FX spread)
- **Mid-market exchange rate** — exactly what Reuters quotes, not what Brightwell quotes
- **Yield on transit** — instead of fees eating your money, JUICED (Jupiter Lend) earns 4.5% APY while your family claims it
- **Instant Boost** — a Jupiter Ultra swap that routes USDC through the best available path, landing the recipient with equal or slightly more than was sent

This is the first remittance product where sending money home can leave the recipient with **more** than you sent.

---

## Live Comparison — Dynamic per Destination Country

The homepage shows a live comparison table that updates based on the destination country the user selects. The app covers 12 destination countries with real fee and FX markup data:

**Example: $100 USD → Philippines (PHP)**

| Provider | Fee | You Pay | Family Receives (est.) |
|---|---|---|---|
| **PasaPay ⚡** | **$0.003** | **$100.003** | **₱6,116** |
| Brightwell | $8.00 | $108.00 | ₱5,396 |
| MoneyGram | $5.00 | $105.00 | ₱5,913 |
| Western Union | $6.99 | $106.99 | ₱5,820 |

*Family receives est. ₱720 more with PasaPay vs Brightwell on a single $100 transfer.*
*Est. amounts based on Apr–May 2026 published rate cards and live mid-market FX.*

The comparison table is **fully dynamic** — selecting any of the 12 destination countries recalculates the rates, fees, and local-currency savings in real time from the live FX API.

---

## Two Send Modes

### ⚡ Instant Send — under 1 second
The app calls `/api/send`, which tries a Jupiter Ultra swap (USDC → best route → USDC) to the recipient's wallet. If the round-trip is net positive after gas, the boosted transaction is returned. If not, the response signals a direct SPL USDC transfer instead. **One wallet approval either way.**

Live quote data from `/api/quote` shows both modes side by side so the user can choose before confirming.

### 🕐 Timed Send — 5, 15, or 30 days
USDC → **JUICED** (Jupiter Lend Earn) → holds for the chosen duration → USDC + yield released to the recipient wallet.

The sender deposits USDC into Jupiter Lend and earns **4.5% APY** during the hold period. When the timer expires, the sender returns to the app and clicks "Release" — the app withdraws from JUICED and sends principal + yield to the recipient in a single flow.

**Why this matters for seafarers:** OFWs often get paid on ship contracts that end on specific dates. A 15 or 30-day timed send lets them deposit when they get paid and have it arrive at the exact time their family needs it — with yield on top instead of fees taken away.

---

## Savings Vault

A simple non-custodial lending interface powered by Jupiter Lend.

- Deposit any amount of USDC into JUICED (jlUSDC) and earn live APY
- Withdraw part or all of your balance at any time — no lock-up period
- Your live balance and accumulated yield are displayed in real time
- 25 / 50 / 75 / MAX quick-fill chips based on your wallet balance

Funds sit in Jupiter Lend, not in any JupRemit contract. The app is purely an interface.

---

## Architecture

```
Seafarer (sender)
    │
    ▼
JupCard virtual US bank account
(receives salary as USDC via ACH)
    │
    ▼
PasaPay / JupRemit dApp
    │
    ├─ Send Screen
    │   ├─ Instant Send:    Ultra /order → boost or direct SPL transfer
    │   └─ Timed Send:      Lend /deposit → JUICED → release with yield
    │
    ├─ Savings Vault
    │   └─ Lend /deposit + /withdraw → JUICED (any amount, anytime)
    │
    └─ Recipient's Solana wallet
        └─ They convert USDC → PHP / IDR / KES / ZAR at their provider's rate
```

---

## Jupiter APIs Used

All calls go through a single API key from [portal.jup.ag](https://portal.jup.ag).

| API | Endpoint | Used for |
|-----|----------|----------|
| **Ultra Swap** | `GET /ultra/v1/order` | Instant Send boost quote (quote route) + boost execution (send route) |
| **Lend Earn** | `GET /lend/v1/earn/tokens` | Live JUICED APY (apy + quote routes) |
| **Lend Earn** | `GET /lend/v1/earn/positions` | Vault balance + Timed Send release check |
| **Lend Earn** | `POST /lend/v1/earn/deposit` | Vault deposit + Timed Send deposit |
| **Lend Earn** | `POST /lend/v1/earn/withdraw` | Vault withdraw |

---

## On-Chain Program — Anchor Instructions

The Anchor program lives at `programs/jupremit/src/lib.rs`.

| Instruction | What it does |
|---|---|
| `initialize` | Deploy global config PDA (owner, fee wallet, pause flag) |
| `create_direct_send` | Lock USDC in escrow PDA with a recipient and auto-release timestamp |
| `claim_direct_send` | Recipient claims before expiry — funds transfer to their wallet |
| `return_to_sender` | Permissionless crank — returns funds after expiry if unclaimed |
| `create_savings_vault` | Create vault PDA, deposit first month's USDC |
| `deposit_monthly` | Top up with next month's deposit |
| `extend_vault` | Sender extends maturity date before expiry |
| `mature_vault` | Permissionless crank — releases funds to sender at maturity |
| `set_paused` | Admin emergency pause |
| `update_fee_wallet` | Admin update protocol fee destination |

**Protocol fee:** 0.2% of yield earned only. Zero fee when no yield. No fee on principal.

---

## Supported Countries

12 destination countries with local offramp providers, selectable dynamically from the homepage:

🇵🇭 Philippines (Coins.ph, GCash, Maya) · 🇮🇩 Indonesia (GoPay, OVO, DANA) · 🇻🇳 Vietnam (MoMo, ZaloPay) · 🇹🇭 Thailand (PromptPay, TrueMoney) · 🇲🇾 Malaysia (Touch'n Go, DuitNow) · 🇸🇬 Singapore (PayNow, GrabPay) · 🇿🇦 South Africa (Standard Bank, FNB, Capitec) · 🇺🇸 USA (ACH, Venmo, Zelle) · 🇳🇬 Nigeria (OPay, Flutterwave) · 🇰🇪 Kenya (M-Pesa) · 🇮🇳 India (UPI, PhonePe) · 🇧🇷 Brazil (Pix, Nubank) · 🌍 200+ countries (any Solana wallet)

---

## Project Structure

```
jupremit/
├── DX-REPORT.md                         ← Developer Experience Report
├── Anchor.toml                          ← Anchor config (cluster, wallet, program IDs)
├── Cargo.toml                           ← Rust workspace
├── programs/jupremit/src/lib.rs         ← Anchor smart contract (all on-chain logic)
├── tests/                               ← Integration tests
├── scripts/deploy-devnet.sh             ← Automated devnet deploy script
└── app/                                 ← Next.js 14 frontend (branded "PasaPay")
    ├── .env.example                     ← All required env vars documented
    ├── .env.local                       ← Your keys (git-ignored, you create this)
    ├── public/
    │   ├── favicon.svg                  ← Browser tab icon
    │   ├── logo.svg                     ← PasaPay app icon
    │   └── jupit-logo.png               ← Background watermark
    └── src/
        ├── app/
        │   ├── page.tsx                 ← Tab router (Home · Send · Vault · Account)
        │   ├── layout.tsx               ← Metadata, wallet adapter, global CSS
        │   ├── globals.css              ← Jupiter dark design system
        │   └── api/                     ← 10 server-side API routes (API key stays server-side)
        │       ├── fx/route.ts          ← GET  live FX rates (open.er-api.com + fallbacks)
        │       ├── apy/route.ts         ← GET  live JUICED APY from Jupiter Lend
        │       ├── balance/route.ts     ← GET  on-chain USDC balance
        │       ├── quote/route.ts       ← GET  live send mode comparison (Ultra quotes + FX)
        │       ├── send/route.ts        ← POST instant boost or direct send signal
        │       ├── position/route.ts    ← GET  user JUICED vault position + yield
        │       ├── lend/
        │       │   ├── deposit/route.ts ← POST build Jupiter Lend deposit tx (Vault)
        │       │   └── withdraw/route.ts← POST build Jupiter Lend withdraw tx (Vault)
        │       └── time-send/
        │           ├── deposit/route.ts ← POST build Jupiter Lend deposit tx (Timed Send)
        │           └── release/route.ts ← POST build JUICED → recipient release tx
        ├── lib/
        │   ├── constants.ts             ← Token mints, countries, providers, FX fallbacks
        │   └── ratelimit.ts             ← Upstash Redis rate limiting (read / tx / quote)
        ├── store/jupremit.ts            ← Zustand global state (recipients, tx history, app)
        └── components/
            ├── ui/
            │   ├── WalletProvider.tsx   ← Phantom / Solflare / Backpack setup
            │   ├── Numpad.tsx           ← Custom numeric keypad
            │   └── QrScannerModal.tsx   ← Camera QR scanner for wallet addresses
            └── screens/
                ├── HomeScreen.tsx       ← Dashboard · country selector · live comparison
                ├── SendScreen.tsx       ← Full send flow (amount → wallet → review → exec)
                ├── VaultScreen.tsx      ← Savings vault (deposit / withdraw JUICED anytime)
                └── AccountScreen.tsx    ← Wallet info · saved recipients · tx history
```

---

## Setup & Run

### Prerequisites
```bash
node --version    # 18+ required
rustc --version   # any stable
solana --version  # 1.18+
anchor --version  # 0.30.1+
```

### 1. Deploy the Anchor program (devnet)
```bash
bash scripts/deploy-devnet.sh
```
This automatically: checks prereqs → airdrops devnet SOL → builds the program → patches `declare_id!` and `Anchor.toml` → deploys → writes the program ID to `app/.env.local`.

### 2. Add your environment variables
```bash
cp app/.env.example app/.env.local
# then fill in your keys — see .env.example for descriptions of each variable
```

Get your free Jupiter API key at [portal.jup.ag](https://portal.jup.ag).
Get a free Helius RPC at [helius.dev](https://helius.dev) (optional but recommended).
Get a free Upstash Redis at [console.upstash.com](https://console.upstash.com) (optional — disables rate limiting if absent).

### 3. Run the frontend
```bash
cd app
npm install
npm run dev
# → http://localhost:3000
```

### 4. Run Anchor tests
```bash
anchor test --provider.cluster devnet
```

---

## How to Submit

**Required by Superteam Earn:**
1. Link to this GitHub repo
2. Link to `DX-REPORT.md` (raw GitHub URL)
3. The email tied to your [portal.jup.ag](https://portal.jup.ag) account

**Judging criteria:**
- DX report quality — 35%
- AI stack feedback — 25%
- Technical execution — 25%
- Creativity & ambition — 15%

---

## Why This Matters

There are 281 million migrant workers in the world. Seafarers alone number 1.9 million. Every one of them sends money home. The global remittance market moves $860 billion a year — and an estimated $48 billion of that is swallowed by fees.

That $48 billion is not an abstraction. It's money that should have fed families, paid school fees, built houses. It went to Brightwell's margins instead.

DeFi has always promised to fix this. JupRemit is the first product that actually closes the loop — from a seafarer's JupCard salary wallet, through Jupiter's swap and lending infrastructure, to a family's Coins.ph peso balance or M-Pesa account — with $0 in fees and the possibility of arriving with more money than was sent.

---

## License

MIT — open source, free to use, fork, and build on.

---

*Built for the Superteam Frontier Hackathon 2026 — Jupiter track: Not Your Regular Bounty.*
*From a seafarer who got tired of watching fees eat his family's money.*
