import { vi } from "vitest";
const data = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
  removeItem: (key: string) => data.delete(key),
  clear: () => data.clear(),
});
