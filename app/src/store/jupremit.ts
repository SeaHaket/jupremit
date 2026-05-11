"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Recipient {
  id: string;
  name: string;
  country: string;
  currency: string;
  provider: string;
  wallet: string;
  flag: string;
  isDefault: boolean;
}

export interface TimedSend {
  id:                  string;
  recipientWallet:     string;
  recipientName:       string;
  recipientFlag:       string;
  recipientProvider:   string;
  amountUsdc:          number;
  depositTxSig:        string;
  depositedAt:         number;   // unix ms
  matureAt:            number;   // unix ms
  holdDays:            5 | 15 | 30;
  juicedAmountRaw:     number;   // jlUSDC units deposited
  status:              "active" | "released" | "failed";
  releaseTxSig?:       string;
  yieldEarnedUsdc?:    number;
}

// ─── Recipient store ───────────────────────────────────────────────────────────

interface RecipientStore {
  recipients:       Recipient[];
  defaultRecipient: Recipient | null;
  addRecipient:     (r: Omit<Recipient, "id">) => Recipient;
  removeRecipient:  (id: string) => void;
  setDefault:       (id: string) => void;
}

export const useRecipientStore = create<RecipientStore>()(
  persist(
    (set, get) => ({
      recipients:       [],
      defaultRecipient: null,

      addRecipient: (r) => {
        const newR: Recipient = { ...r, id: nanoid(8) };
        if (get().recipients.length === 0) newR.isDefault = true;
        set((s) => ({
          recipients:       [...s.recipients, newR],
          defaultRecipient: newR.isDefault ? newR : s.defaultRecipient,
        }));
        return newR;
      },

      removeRecipient: (id) =>
        set((s) => {
          const filtered = s.recipients.filter((r) => r.id !== id);
          if (filtered.length > 0 && !filtered.some((r) => r.isDefault)) {
            filtered[0].isDefault = true;
          }
          return {
            recipients:       filtered,
            defaultRecipient: filtered.find((r) => r.isDefault) ?? filtered[0] ?? null,
          };
        }),

      setDefault: (id) =>
        set((s) => {
          const updated = s.recipients.map((r) => ({ ...r, isDefault: r.id === id }));
          return {
            recipients:       updated,
            defaultRecipient: updated.find((r) => r.id === id) ?? null,
          };
        }),
    }),
    { name: "jupremit-recipients-v2" }
  )
);

// ─── Timed send store ──────────────────────────────────────────────────────────

interface TimedSendStore {
  timedSends:     TimedSend[];
  addTimedSend:   (ts: Omit<TimedSend, "id">) => TimedSend;
  markReleased:   (id: string, releaseTxSig: string, yieldEarnedUsdc: number) => void;
  markFailed:     (id: string) => void;
  removeTimedSend:(id: string) => void;
}

export const useTimedSendStore = create<TimedSendStore>()(
  persist(
    (set) => ({
      timedSends: [],

      addTimedSend: (ts) => {
        const newTs: TimedSend = { ...ts, id: nanoid(8) };
        set((s) => ({ timedSends: [newTs, ...s.timedSends] }));
        return newTs;
      },

      markReleased: (id, releaseTxSig, yieldEarnedUsdc) =>
        set((s) => ({
          timedSends: s.timedSends.map((t) =>
            t.id === id ? { ...t, status: "released", releaseTxSig, yieldEarnedUsdc } : t
          ),
        })),

      markFailed: (id) =>
        set((s) => ({
          timedSends: s.timedSends.map((t) =>
            t.id === id ? { ...t, status: "failed" } : t
          ),
        })),

      removeTimedSend: (id) =>
        set((s) => ({ timedSends: s.timedSends.filter((t) => t.id !== id) })),
    }),
    { name: "jupremit-timed-sends-v1" }
  )
);

// ─── Transaction history store ────────────────────────────────────────────────

export interface TxRecord {
  id: string;
  type: "instant_send" | "timed_deposit" | "timed_release";
  amountUsdc: number;
  feeUsdc: number;
  txSig: string;
  ts: number;
  toName?: string;
  toWallet?: string;
  strategy?: "instant_boost" | "direct";
  yieldUsdc?: number;
}

interface TxHistoryStore {
  txHistory: TxRecord[];
  addTx: (tx: Omit<TxRecord, "id">) => void;
  clearHistory: () => void;
}

export const useTxHistoryStore = create<TxHistoryStore>()(
  persist(
    (set) => ({
      txHistory: [],
      addTx: (tx) => {
        const newTx: TxRecord = { ...tx, id: nanoid(8) };
        set((s) => ({ txHistory: [newTx, ...s.txHistory].slice(0, 100) }));
      },
      clearHistory: () => set({ txHistory: [] }),
    }),
    { name: "jupremit-tx-history-v1" }
  )
);

// ─── App store ────────────────────────────────────────────────────────────────

interface AppState {
  sendAmount:      number;
  selectedMode:    "instant_boost" | "timed";
  holdDays:        5 | 15 | 30;
  juicedApy:       number;
  setSendAmount:   (n: number) => void;
  setSelectedMode: (m: "instant_boost" | "timed") => void;
  setHoldDays:     (d: 5 | 15 | 30) => void;
  setJuicedApy:    (apy: number) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  sendAmount:      100,
  selectedMode:    "instant_boost",
  holdDays:        5,
  juicedApy:       4.5,
  setSendAmount:   (n)   => set({ sendAmount: n }),
  setSelectedMode: (m)   => set({ selectedMode: m }),
  setHoldDays:     (d)   => set({ holdDays: d }),
  setJuicedApy:    (apy) => set({ juicedApy: apy }),
}));
