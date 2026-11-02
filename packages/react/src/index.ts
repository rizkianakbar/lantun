import { useEffect } from "react";
import { destroy, init, type ReaderOptions } from "@lantun/core";

export { registerVoices } from "@lantun/core";

export type ReaderWidgetProps = ReaderOptions;

// Core is a page-level singleton, so the wrapper renders nothing and only owns its lifetime.
export const ReaderWidget = (props: ReaderWidgetProps): null => {
  const key = JSON.stringify(props);
  useEffect(() => {
    init(props);
    return () => {
      destroy();
    };
    // Keyed on the serialised options so a new-but-equal props object does not re-init.
  }, [key]);
  return null;
};
