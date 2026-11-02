// prefix warnings with the library name for consistent, identifiable logs.
export function warn(...args: unknown[]): void {
  console.warn("[Lantun]", ...args);
}

// wraps a function with error handling, logging failures and returning undefined.
export function guard<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => R,
) {
  return (...args: A): R | undefined => {
    try {
      return fn(...args);
    } catch (err) {
      warn(`${name}() failed`, err);
      return undefined;
    }
  };
}

// return whether debug mode is enabled. defaults to false if storage is unavailable.
export function isDebug(): boolean {
  try {
    return globalThis.localStorage?.getItem("lantun:debug") === "1";
  } catch {
    return false;
  }
}

export function debug(...args: unknown[]): void {
  if (isDebug()) {
    console.info("[Lantun]", ...args);
  }
}
