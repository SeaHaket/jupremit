# JupRemit (PasaPay) — Developer Experience Report
**Submitted for: Not Your Regular Bounty — Jupiter Frontier Hackathon**
**Developer Platform account:** jupinoy.meow@gmail.com
**Project:** JupRemit / PasaPay — Global DeFi Remittance dApp on Jupiter
**APIs used:** Ultra Swap V2, Jupiter Lend (Earn), Price V2, FX data

---

## Onboarding

**Time from landing on developers.jup.ag to first successful API call: ~12 minutes.**

The portal itself (`portal.jup.ag`) is clean. One key, everything unlocked. That part works exactly as advertised. The friction was not in key issuance — it was in figuring out which API to call once I had the key.

Specific path I took:
1. Landed on `dev.jup.ag`. Saw the product grid. Clicked "Ultra Swap."
2. Read the `/order` endpoint doc. Clear. Made the call within 5 minutes, got a valid response.
3. Then tried to find the Lend API. **This is where things got slow.**

The navigation sidebar mixes "docs" and "API reference" in a way that makes it unclear whether you're looking at conceptual explanation or callable endpoints. I spent ~20 minutes reading the Lend SDK section before realizing the REST API (`/lend/v1/earn/deposit`) was on a completely separate page (`Earn API (Beta)`) three clicks away from the overview.

---

## What's broken or missing in the docs

### 1. `/lend/v1/earn/tokens` response shape is underdocumented

**Page:** `dev.jup.ag/docs/lend/earn/api` → Tokens section

The code snippet shows how to fetch, but shows zero example response. For a route that drives every downstream decision (which mint is JUICED, what's the APY, what's the exchange price), the absence of a sample response is a real problem. I had to guess field names (`supplyApy`, `fTokenMint`, `tokenExchangePrice`) by cross-referencing the Rust struct on the overview page with what the endpoint actually returned in practice.

**What I wanted:** A collapsed JSON block showing one token entry from the real endpoint. Even a stale one. Anything.

**Impact:** Added ~45 minutes of trial-and-error. I initially used `apy` instead of `supplyApy` and got `undefined` silently.

---

### 2. The `swapType` field in Ultra `/order` response is documented but never explained

**Page:** `dev.jup.ag/docs/ultra/response`

The response schema lists `swapType` but gives no enum values and no explanation of what they mean for execution. In practice I got `"rfq"` vs `"jupiter"` in different calls and had no idea whether this changed how I should handle the signed transaction.

**What I wanted:** A table of possible `swapType` values and what, if anything, the caller needs to do differently for each.

---

### 3. No clear guidance on JUICED mint address

The Lend overview talks about "jlTokens" and "JUICED" but never gives you the actual mint address for the jlJupUSD token anywhere in the docs. I had to fetch `/lend/v1/earn/tokens`, iterate the results, and infer which entry corresponded to JUICED by checking the symbol field — which on devnet returned nothing because the endpoint only works on mainnet.

**What I wanted:** A "Program Addresses" equivalent page for Earn tokens, listing mint addresses, fToken mints, and which cluster they exist on.

---

### 4. Lend API is mainnet-only but devnet workflow is undocumented

When building on devnet for testing, `/lend/v1/earn/deposit` returns a valid-looking response but the transaction fails on-chain because the Lend program doesn't exist at that address on devnet. There is no mention of this anywhere in the Earn API docs.

**What I wanted:** A single callout box: "Lend is mainnet only. For testing, mock the deposit instruction or use a mainnet fork." That one sentence would have saved me two hours of debugging a transaction that looked right but couldn't land.

---

### 5. Ultra `/execute` polling behavior is underspecified for dropped connections

**Page:** `dev.jup.ag/docs/ultra/execute-order`

The docs say you can resubmit the same `signedTransaction` + `requestId` for up to 2 minutes. What they don't say: what does the response look like when the transaction already landed and you're polling? Does `status` change to `"Success"` even on a second call? Does it throw? Does it return a different code?

In my implementation I had to just assume it would work and add a try-catch. For production payment flows this ambiguity is genuinely dangerous.

---

### 6. `referralFee` in `/order` is in bps but the docs just say "basis points" with no worked example

A developer new to bps will set `referralFee: 0.2` instead of `referralFee: 20` and silently get a different fee than intended. One example calculation in the docs would eliminate this class of error entirely.

---

## Where the APIs bit me

### Ultra Swap: JupUSD/USDC spread is real but inconsistent

The core insight of PasaPay's Instant Boost mode is that JupUSD trades at a slight premium to USDC. From live data: 100 USDC → 99.963732 JupUSD → 100.005184 USDC, routed via OKX DEX Router at 0.00% platform fee. This is profitable. But the spread is not consistent — it depends on liquidity depth at the time of the quote. The round-trip can be flat or slightly negative during low-liquidity windows. The `/order` endpoint gives you the live quote but no indication of historical spread distribution. A "spread confidence" signal or a 24h average would make this use case much more reliable to build on.

### Lend: No way to check if a deposit will succeed before signing

If the user tries to deposit more USDC than they have an ATA for, or if the Lend program's debt ceiling is hit, the transaction fails after signing — meaning the user already clicked "approve" in their wallet and nothing happened. There is no dry-run or simulation endpoint in the Lend API. A `/simulate` endpoint that returns expected output amounts and failure reasons would be extremely valuable, especially for payment UX where a failed transaction is a terrible experience.

### Price API: `ids` param silently drops unrecognized mints

If you pass a mint that doesn't exist in the Price API's index, it's silently omitted from the response with no error or warning. I spent time thinking the JupUSD mint address was wrong before I realized it just wasn't indexed.

---

## AI Stack Feedback

I used **Claude Code** (Anthropic) with the Jupiter docs as context throughout this build. This is a CLI-based AI coding tool that works directly inside the project directory — it can read files, run commands, and write code end-to-end.

### What worked

- The Ultra Swap API is AI-friendly by design. The endpoint is REST, the parameters are self-explanatory, and the response shape is consistent. Claude Code was able to generate correct integration code on the first attempt with just the doc URL as context.
- `/price/v2` is similarly excellent for AI. Simple GET, clean JSON, predictable.
- Claude Code handled the full frontend build — all four screens (Home, Send, Vault, Account), the dynamic country selector with live FX comparison for all 12 destination countries, the Savings Vault flow, and the custom numpad — in a single long session. The Jupiter dark design system translated cleanly from CSS variables into inline React styles.
- The FX route (`/api/fx`) with automatic fallback rates was generated correctly on the first pass, including the open.er-api.com integration and per-currency fallback values for all 12 supported destinations.

### What didn't work

- **Jupiter Agent Skills**: I looked for a pre-built Skills file for the Lend Earn API. It doesn't exist at the time of writing. The Swap skill exists and is useful. The Lend skill is missing. For a hackathon where developers are time-constrained, this is the highest-leverage gap to fill.
- **Docs MCP**: Useful for navigating between Ultra Swap pages, but it can't traverse the API reference sidebar correctly — it would return the overview page when I asked for the `/earn/deposit` endpoint details. Several queries returned correct-looking but wrong page content.
- **Jupiter CLI**: I didn't use this for JupRemit specifically because the payment flow requires user wallet signing, which the CLI doesn't support in a webapp context. Would be useful for backend testing of swap quotes.

### What I wish existed

1. **A Lend Earn Agent Skill** with the same depth as the Swap skill — listing endpoint shapes, auth requirements, and worked TypeScript examples. Would have cut my integration time in half.
2. **A devnet mode for Lend** — even a mock server that accepts the same request shape and returns plausible responses. Building payment flows without being able to test the Lend path end-to-end on devnet is a significant quality risk.
3. **Error code reference** — a single page listing all error codes returned by all Jupiter APIs with explanations. Right now error messages come back as free-text strings that vary in format between the Swap and Lend APIs.

---

## How would I rebuild developers.jup.ag

If I were the engineer behind the Developer Platform, here's what I'd change to get developers making their first API call in under 5 minutes:

**1. A single "quickstart" flow for each API, not a narrative doc**
Every API should have a 3-step quickstart at the top of its page: install, set key, make first call, see result. No preamble. The current docs bury the code under conceptual explanation. Swap has this reasonably well; Lend does not.

**2. Interactive "try it" in the API reference sidebar**
The API reference pages exist but they're static. If you could put your API key into a field and hit each endpoint directly from the docs page, the time-to-first-call drops to under 2 minutes. Every other major API platform does this now (Stripe, OpenAI, Alchemy). Jupiter should too.

**3. Collapse the Earn/Borrow/Lend navigation**
Currently Earn, Borrow, Flashloan, Liquidity, and Advanced each have separate sidebar sections with overlapping sub-pages. A developer who just wants to "deposit and earn" has to make 4-5 navigation decisions before reaching callable code. Consolidate this into a single "Lend" entry with sub-tabs: Earn / Borrow / Flashloan.

**4. Add a "What's on devnet" page**
A single table: API name, mainnet support ✓/✗, devnet support ✓/✗, devnet limitations. This is the most actionable single page that doesn't exist right now.

**5. Surface the `swapType` field behavior**
If a response field changes how a developer should handle execution, it needs to be documented. `swapType` currently does not meet this bar.

---

## What I wish existed (endpoints, SDK support, features)

1. **`/lend/v1/earn/simulate`** — dry-run a deposit or withdraw and return expected output amounts, failure reasons, and estimated gas. Critical for payment UX.

2. **`/ultra/v1/spread`** — historical spread distribution for any token pair over the last 24h. Would let builders decide whether a spread-arbitrage strategy is viable before committing to it.

3. **Lend devnet deployment** — even with reduced liquidity. Currently impossible to test the full JupRemit payment flow without going to mainnet.

4. **Lend SDK TypeScript types as a standalone npm package** — the types for `LendToken`, `LendPosition`, `LendEarnings` are not exported from any public package. I had to write them by hand from the Rust struct definitions in the docs.

5. **A unified "did this transaction land" webhook** — right now polling the `/execute` endpoint for status is the only option. A webhook or SSE stream that pushes status when a swap confirms would eliminate an entire class of polling logic in frontend apps.

6. **JupCard APIs** — the JupCard product (virtual US bank account for receiving salary as USDC) is central to the OFW use case but has no documented developer API. The on/off-ramp surface area is the biggest gap between Jupiter's DeFi capabilities and real-world payment product use cases.

---

## Timed Send — Jupiter Lend Integration

One of the more creative API combinations in PasaPay is the **Timed Send** feature. Instead of sending USDC immediately, the sender can choose a 5, 15, or 30-day hold period. The USDC goes into JUICED (Jupiter Lend Earn) and earns 4.5% APY while the hold timer runs. After the period ends, the sender triggers a release — Jupiter Lend withdraws the USDC + yield, and it transfers to the recipient in one flow.

This took significant API exploration to build. Key findings:

**`POST /lend/v1/earn/deposit`** works exactly as documented once you have the correct asset mint and amount format. The transaction it returns is a standard VersionedTransaction that signs cleanly via wallet adapter.

**`GET /lend/v1/earn/positions`** is needed to know the current jlUSDC value at release time. The position response shape wasn't fully documented — `balanceUsdc` field gives the current USDC-equivalent value, which is what you need to calculate yield earned.

**`POST /lend/v1/earn/withdraw`** returns the withdrawal transaction. One thing not clear in docs: after withdrawing, the USDC lands in the *signer's* wallet (not directly to a third party). So the release flow requires two transactions: withdraw to sender, then SPL transfer to recipient. This is expected behavior but wasn't explicitly stated.

The Timed Send feature also documents a real product insight: for OFWs sending money to family, a 15-30 day hold earning yield is actually useful — many seafarers get paid monthly and want funds to arrive at a specific time, not immediately. The yield is a bonus, not the main feature.

---

## Why I Built This

I am a seafarer. I live on ships for months at a time, and every month I open Brightwell to send money home to my family. Every month the same thing happens — $8 flat fee, a 4% FX spread on top, and by the time the money lands it's meaningfully less than what I sent. That money came from working at sea, away from my family. The remittance industry's answer is to charge me for the privilege of sending it home.

I built JupRemit because DeFi can actually fix this — and because nobody has built this specific product for this specific audience yet.

But the vision goes further than remittance. Seafarers already carry paycards. We already use them to buy things at port. Crypto cards are proliferating everywhere, but most of them are built for crypto natives and will disappear when the memecoin mania fades. The projects that survive will be the ones that found real distribution with real users who have a real problem.

JupRemit (branded PasaPay in the app) is designed to position JupCard as the card that normal people — OFWs, seafarers, migrant workers — actually use. Not because they care about DeFi, but because it stops fees from eating their family's money and starts putting yield in their pocket instead. That's the unlock nobody in this space has executed on yet: 281 million migrant workers as a distribution channel for Jupiter's ecosystem.

The technical work in this DX report is real. The bugs I documented are real. But so is the reason I spent three days debugging Rust borrow checker errors and anchor-syn GLIBC incompatibilities at sea — because the product on the other side of those errors is worth building.

---

## Summary

Jupiter's APIs are genuinely good infrastructure. The Ultra Swap V2 (`/order` + `/execute`) is the cleanest swap API I've used on any chain. The Lend Earn REST API is a great idea that's 80% of the way to being developer-friendly — the last 20% is devnet support, response documentation, and error transparency.

The biggest unlock for the developer ecosystem is not new features — it's filling the documentation gaps that make the existing features take 4 hours to integrate instead of 30 minutes. The Lend Earn Agent Skill alone would meaningfully increase the number of projects that successfully integrate it in a hackathon context.

**JupRemit demonstrates that the "last mile" of DeFi remittance — sending money home for almost free, earning yield on transit — is now technically possible with Jupiter's stack.** The gaps are in developer tooling, not in the underlying protocol.

The app covers 12 destination countries (Philippines, Indonesia, Vietnam, Thailand, Malaysia, Singapore, South Africa, USA, Nigeria, Kenya, India, Brazil) with a live dynamic comparison table on the homepage showing exactly how much more a family receives via PasaPay vs Western Union, MoneyGram, Brightwell, or Remitly — in local currency, in real time.

---

*Report written honestly from 3 days of build experience. All bugs documented above were observed in the actual codebase. Links to specific doc pages included where applicable.*
