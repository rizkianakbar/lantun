import { warn } from "./log";

type Handler = (payload: unknown) => void;

export const createEmitter = <E extends string>() => {
  const handlers = new Map<E, Set<Handler>>();
  return {
    on(event: E, cb: Handler): () => void {
      let set = handlers.get(event);
      if (!set) handlers.set(event, (set = new Set()));
      set.add(cb);
      return () => set.delete(cb);
    },
    emit(event: E, payload?: unknown): void {
      handlers.get(event)?.forEach((cb) => {
        // A throwing publisher callback must not stop playback or other listeners.
        try {
          cb(payload);
        } catch (err) {
          warn(`'${event}' listener threw:`, err);
        }
      });
    },
    clear(): void {
      handlers.clear();
    },
  };
};
