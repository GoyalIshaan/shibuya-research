import { create } from 'zustand';
import { Signal } from '@/lib/data-sources/types';

interface SignalsStore {
  signals: Signal[];
  isLoading: boolean;
  lastUpdated: Date | null;
  
  // Actions
  setSignals: (signals: Signal[]) => void;
  addSignals: (newSignals: Signal[]) => void;
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
