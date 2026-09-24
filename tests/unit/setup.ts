/**
 * Minimal test harness for the unit suites (run with `npm test`).
 * Installs an in-memory localStorage and provides tiny assertion helpers,
 * so the pure frontend logic can run in Node without extra dependencies.
 */

export const mem = new Map<string, string>();

(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => Array.from(mem.keys())[i] ?? null,
  get length() {
    return mem.size;
  },
};

let passed = 0;
let failed = 0;

export function eq(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${
      ok ? '' : `  -> got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
    }`
  );
}

export function finish(): void {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
