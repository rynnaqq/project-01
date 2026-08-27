// Minimal localStorage shim for vitest (Node environment).
// Browser localStorage is used by ProgressManager at runtime; this stub
// keeps an in-memory store so tests can exercise persistence logic.
class LocalStorageStub {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

const stub = new LocalStorageStub();
(globalThis as { localStorage?: Storage }).localStorage =
  stub as unknown as Storage;
