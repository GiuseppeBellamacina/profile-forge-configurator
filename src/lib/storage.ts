// Safe wrappers: storage can be unavailable (private mode, tests). Same keys as the previous version of the site.
const wrap = (get: () => Storage) => ({
  get<T>(key: string): T | null {
    try { return JSON.parse(get().getItem(key) ?? "null"); } catch { return null; }
  },
  set(key: string, value: unknown) {
    try { value == null ? get().removeItem(key) : get().setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
});
export const local = wrap(() => localStorage);
export const session = wrap(() => sessionStorage);
