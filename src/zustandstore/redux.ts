import { create } from "zustand";

interface ParamsStore {
  paramsData: any;
  setParamsData: (by: any) => void;
}

export const ParamsStore = create<ParamsStore>((set: any) => ({
  paramsData: {},
  setParamsData: (data: any) => {
    set(() => ({
      paramsData: data,
    }));
  },
}));
