// ─── Jupiter API types ────────────────────────────────────────────────────────

export interface UltraOrderResponse {
  requestId:   string;
  transaction: string | null;  // base64, null if no taker
  inAmount:    string;
  outAmount:   string;
  inUsdValue:  number;
  outUsdValue: number;
  priceImpact: number;
  swapMode:    string;
  slippageBps: number;
  routePlan:   RoutePlanItem[];
  feeBps:      number;
  errorCode?:  string;
  errorMessage?: string;
}

export interface RoutePlanItem {
  swapInfo: {
    ammKey:    string;
    label:     string;
    inputMint: string;
    outputMint: string;
    inAmount:  string;
    outAmount: string;
  };
  percent: number;
}

export interface UltraExecuteResponse {
  status:              "Success" | "Failed";
  signature:           string;
  slot:                string;
  code:                number;
  inputAmountResult:   string;
  outputAmountResult:  string;
  error?:              string;
  swapEvents?:         SwapEvent[];
}

export interface SwapEvent {
  inputMint:    string;
  inputAmount:  string;
  outputMint:   string;
  outputAmount: string;
}

// ─── Jupiter Lend API types ───────────────────────────────────────────────────

export interface LendToken {
  mint:          string;
  fTokenMint:    string;
  symbol:        string;
  decimals:      number;
  supplyApy:     number;    // annualised %
  totalSupply:   string;
  exchangePrice: number;    // scaled — jlToken per underlying
}

export interface LendPosition {
  address:       string;   // position account
  ownerAddress:  string;
  asset:         string;   // underlying mint
  shares:        string;   // jlToken balance
  assets:        string;   // underlying equivalent
  balance:       string;   // wallet balance
}

export interface LendEarnings {
  address:      string;
  ownerAddress: string;
  earnings:     number;
  slot:         number;
}

export interface LendDepositResponse {
  transaction: string;  // base64 unsigned tx
}

// ─── JupRemit app types ───────────────────────────────────────────────────────

export type YieldVehicle = "USDC" | "JUPUSD" | "JUICED";
export type SendMode     = "instant_boost" | "transit_yield" | "savings";
export type SendStep     =
  | "idle" | "routing" | "swapping"
  | "depositing" | "transferring" | "success" | "error";

export interface Recipient {
  id:        string;
  name:      string;
  country:   string;
  currency:  string;
  provider:  string;
  wallet:    string;   // Solana address or ref
  flag:      string;
  isDefault: boolean;
}

export interface FxRates {
  base:      string;
  rates:     Record<string, number>;
  fetchedAt: number;
  source:    string;
}

export interface InstantBoostQuote {
  sendAmountUsdc:   number;
  step1Out:         number;   // USDC → JupUSD
  step2Out:         number;   // JupUSD → USDC
  netGainUsdc:      number;
  netGainBps:       number;
  step1Route:       string;
  step2Route:       string;
  isPositive:       boolean;
  localEquivalent:  number;
  localCurrency:    string;
}

export interface TransitYieldQuote {
  vehicle:        YieldVehicle;
  apy:            number;
  holdDays:       number;
  projectedYield: number;
  swapCost:       number;
  netGain:        number;
  localEquivalent: number;
}

export interface CompetitorData {
  jupremit:     { fee: number; youPay: number; localAmt: number };
  brightwell:   { fee: number; youPay: number; localAmt: number; fxRate: number };
  moneygram:    { fee: number; youPay: number; localAmt: number; fxRate: number };
  westernUnion: { fee: number; youPay: number; localAmt: number; fxRate: number };
  midMarketRate:  number;
  currencySymbol: string;
  disclaimer:     string;
}

export interface VaultProjection {
  totalDeposited:  number;
  projectedYield:  number;
  routerCost:      number;
  netReturn:       number;
  returnPct:       number;
}

export interface SendFlowState {
  step:         SendStep;
  mode:         SendMode;
  signatures:   string[];
  finalUsdc:    number;
  netGain:      number;
  error:        string | null;
}
