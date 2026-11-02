import { warn } from "./log";

type Handler = (payload: unknown) => void;

export interface Emitter<E extends string> {
  on(event: E, handler: Handler): () => void;
  emit(event: E, payload?: unknown): void;
  clear(): void;
}

export function createEmitter<E extends string>(): Emitter<E> {
  const handlers = new Map<E, Set<Handler>>();

  return {
    on(event, handler) {
      let set = handlers.get(event);

      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }

      set.add(handler);

      return () => set.delete(handler);
    },

    emit(event, payload) {
      for (const handler of handlers.get(event) ?? []) {
        // A throwing publisher callback must not stop playback or other listeners.
        try {
          handler(payload);
        } catch (err) {
          warn(`'${event}' listener threw:`, err);
        }
      }
    },

    clear() {
      handlers.clear();
    },
  };
}
