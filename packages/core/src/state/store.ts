export type Listener<T> = (state: T) => void;

export interface Store<T extends object> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(fn: Listener<T>): () => void;
}

// shallow-merge store: notifies only when a top-level value actually changed.
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;

  const listeners = new Set<Listener<T>>();

  return {
    get: () => state,
    set(patch) {
      let changed = false;
      for (const k in patch) {
        if (!Object.is(patch[k], state[k])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;

      state = { ...state, ...patch };

      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);

      return () => listeners.delete(fn);
    },
  };
}
