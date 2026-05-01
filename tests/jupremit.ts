/**
 * JupRemit — Zustand global state
 * Manages: wallet, recipients, send flow, FX rates, APY
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Recipient, SendFlowState, SendMode, SendStep,
  FxRates, InstantBoostQuote, TransitYieldQuote, CompetitorData,
} from "@/types";
import { nanoid } from "nanoid";

// ─── Recipient store ──────────────────────────────────────────────────────────

interface RecipientStore {
  recipients:       Recipient[];
  addRecipient:     (r: Omit<Recipient, "id">) => Recipient;
  updateRecipient:  (id: string, updates: Partial<Recipient>) => void;
  removeRecipient:  (id: string) => void;
  setDefault:       (id: string) => void;
  defaultRecipient: () => Recipient | null;
}

export const useRecipientStore = create<RecipientStore>()(
  persist(
    (set, get) => ({
      recipients: [],

      addRecipient: (r) => {
        const newR: Recipient = { ...r, id: nanoid(8) };
        // If this is the first recipient, make it default
        if (get().recipients.length === 0) newR.isDefault = true;
        set((s) => ({ recipients: [...s.recipients, newR] }));
        return newR;
      },

      updateRecipient: (id, updates) =>
        set((s) => ({
          recipients: s.recipients.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      removeRecipient: (id) =>
        set((s) => {
          const filtered = s.recipients.filter((r) => r.id !== id);
          // If we removed the default, make the first remaining one default
          if (filtered.length > 0 && !filtered.some((r) => r.isDefault)) {
            filtered[0].isDefault = true;
          }
          return { recipients: filtered };
        }),

      setDefault: (id) =>
        set((s) => ({
          recipients: s.recipients.map((r) => ({
            ...r,
            isDefault: r.id === id,
          })),
        })),

      defaultRecipient: () =>
        get().recipients.find((r) => r.isDefault) ?? get().recipients[0] ?? null,
    }),
    {
      name: "jupremit-recipients-v1",
    }
  )
);

// ─── App state ────────────────────────────────────────────────────────────────

interface AppState {
  // Send form
  sendAmount:        number;
  selectedMode:      SendMode;
  holdDays:          number;

  // Quotes (populated from /api/quote)
  instantBoostQuote: InstantBoostQuote | null;
  transitYieldQuote: TransitYieldQuote | null;
  competitors:       CompetitorData | null;
  fxRates:           FxRates | null;
  juicedApy:         number;
  recommended:       SendMode;

  // Flow state
  flow:              SendFlowState;

  // Loading
  quoteLoading:      boolean;
  quoteError:        string | null;

  // Actions
  setSendAmount:     (n: number) => void;
  setSelectedMode:   (m: SendMode) => void;
  setHoldDays:       (d: number) => void;
  loadQuote:         (wallet: string, currency: string) => Promise<void>;
  startFlow:         (mode: SendMode) => void;
  advanceFlow:       (step: SendStep, updates?: Partial<SendFlowState>) => void;
  resetFlow:         () => void;
  setJuicedApy:      (apy: number) => void;
  setFxRates:        (r: FxRates) => void;
}

const initialFlow: SendFlowState = {
  step:       "idle",
  mode:       "instant_boost",
  signatures: [],
  finalUsdc:  0,
  netGain:    0,
  error:      null,
};

export const useAppStore = create<AppState>()((set, get) => ({
  sendAmount:        100,
  selectedMode:      "instant_boost",
  holdDays:          3,
  instantBoostQuote: null,
  transitYieldQuote: null,
  competitors:       null,
  fxRates:           null,
  juicedApy:         4.5,
  recommended:       "instant_boost",
  flow:              initialFlow,
  quoteLoading:      false,
  quoteError:        null,

  setSendAmount:   (n) => set({ sendAmount: n }),
  setSelectedMode: (m) => set({ selectedMode: m }),
  setHoldDays:     (d) => set({ holdDays: d }),
  setJuicedApy:    (apy) => set({ juicedApy: apy }),
  setFxRates:      (r) => set({ fxRates: r }),

  loadQuote: async (wallet, currency) => {
    const { sendAmount, holdDays } = get();
    set({ quoteLoading: true, quoteError: null });
    try {
      const res = await fetch(
        `/api/quote?amount=${sendAmount}&currency=${currency}` +
        `&wallet=${wallet}&holdDays=${holdDays}`
      );
      if (!res.ok) throw new Error(`Quote API ${res.status}`);
      const data = await res.json();
      set({
        instantBoostQuote: data.instantBoost,
        transitYieldQuote: data.transitYield,
        competitors:       data.competitors,
        recommended:       data.recommended,
        fxRates:           data.fxRates ?? get().fxRates,
        quoteLoading:      false,
      });
      // Auto-select recommended mode
      set({ selectedMode: data.recommended });
    } catch (e: unknown) {
      set({ quoteError: (e as Error).message, quoteLoading: false });
    }
  },

  startFlow: (mode) =>
    set({ flow: { ...initialFlow, step: "routing", mode } }),

  advanceFlow: (step, updates = {}) =>
    set((s) => ({ flow: { ...s.flow, step, ...updates } })),

  resetFlow: () => set({ flow: initialFlow }),
}));
