import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { z } from "zod";
import { settingsSchema } from "@/lib/validators";
export type Settings = z.infer<typeof settingsSchema>;
export const useSettingsStore = create<{
  settings: Settings;
  save: (settings: Settings) => void;
}>()(
  persist(
    (set) => ({
      settings: {
        strictness: "balanced",
        retries: 2,
        autoAdvance: true,
        verbal: true,
      },
      save: (settings) => set({ settings: settingsSchema.parse(settings) }),
    }),
    {
      name: "demo-settings-v1",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
