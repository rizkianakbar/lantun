import { destroy, init, type ReaderOptions } from "@lantun/core";
import { useEffect } from "react";

export { registerVoices } from "@lantun/core";

export type ReaderWidgetProps = ReaderOptions;

// Core is a page-level singleton, so the wrapper renders nothing and only owns its lifetime.
export function ReaderWidget(props: ReaderWidgetProps): null {
  const key = JSON.stringify(props);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the serialised options, so equal props never re-init
  useEffect(() => {
    init(props);

    return () => {
      destroy();
    };
  }, [key]);

  return null;
}
