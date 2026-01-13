import { create } from 'zustand';

// Flexible signal type that accepts data from both DB and client
export interface StoreSignal {
  id?: string;
  source: string;
  type: string;
  authorHandle?: string | null;
  timestamp: Date | string;
  url?: string | null;
  text: string;
  engagement?: { likes?: number; replies?: number; views?: number; upvotes?: number; score?: number } | null;
  language?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

interface SignalsStore {
  signals: StoreSignal[];
  isLoading: boolean;
  lastUpdated: Date | null;
  
  // Actions
  setSignals: (signals: StoreSignal[]) => void;
  addSignals: (newSignals: StoreSignal[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  clearSignals: () => void;
}

export const useSignalsStore = create<SignalsStore>((set) => ({
  signals: [],
  isLoading: false,
  lastUpdated: null,

  setSignals: (signals) => set({ 
    signals, 
    lastUpdated: new Date(),
    isLoading: false 
  }),

  addSignals: (newSignals) => set((state) => ({ 
    signals: [...state.signals, ...newSignals],
    lastUpdated: new Date()
  })),

  setIsLoading: (isLoading) => set({ isLoading }),
  
  clearSignals: () => set({ signals: [] })
}));
