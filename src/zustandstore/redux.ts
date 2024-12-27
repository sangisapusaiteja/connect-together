import { create } from "zustand";

interface ParamsStore {
  messageLength: number;
  setMessageLength: (length: number) => void;
}

export const useParamsStore = create<ParamsStore>((set) => ({
  messageLength: 0, // Default value is a number
  setMessageLength: (length) => {
    set(() => ({
      messageLength: length,
    }));
  },
}));
