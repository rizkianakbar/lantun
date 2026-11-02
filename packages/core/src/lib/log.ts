export function warn(...args: unknown[]): void {
  console.warn("[Lantun]", ...args);
}

// Wraps a public API function so a failure is logged instead of breaking the host page.
export function guard<A extends unknown[], R>(name: string, fn: (...args: A) => R): (...args: A) => R | undefined {
  return function guarded(...args: A): R | undefined {
    try {
      return fn(...args);
    } catch (err) {
      warn(`${name}() failed`, err);

      return undefined;
    }
  };
}

// Enabled with localStorage.setItem("lantun:debug", "1").
export function isDebug(): boolean {
  try {
    return globalThis.localStorage?.getItem("lantun:debug") === "1";
  } catch {
    return false;
  }
}

export function debug(...args: unknown[]): void {
  if (isDebug()) console.info("[Lantun]", ...args);
}
