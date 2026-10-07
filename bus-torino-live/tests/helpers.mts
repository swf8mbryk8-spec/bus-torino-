let fails = 0, total = 0;
export function ok(c: boolean, m: string) { total++; console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; }
export function done(name: string) { console.log(`\n${name}: ${total - fails}/${total} ok`); if (fails) process.exit(1); }
export function memoryStorage() {
  const m = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
  return m;
}
