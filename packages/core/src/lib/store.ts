export type Listener<T> = (state: T) => void;

export interface Store<T extends object> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: Listener<T>): () => void;
}

// Shallow-merge store that notifies only when a top-level value actually changed.
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  function changes(patch: Partial<T>): boolean {
    for (const key in patch) {
      if (!Object.is(patch[key], state[key])) return true;
    }

    return false;
  }

  return {
    get() {
      return state;
    },

    set(patch) {
      if (!changes(patch)) return;

      state = { ...state, ...patch };

      for (const listener of listeners) listener(state);
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
}
