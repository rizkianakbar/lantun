import { expect, it, vi } from "vitest";
import { onMessage } from "./worker";
import type { FromWorker, ToWorker } from "./worker.types";

function send(data: ToWorker): void {
  onMessage({ data } as MessageEvent<ToWorker>);
}

function synth(id: number, urgent: boolean): ToWorker {
  return { type: "synth", id, text: "Hi.", voice: "Jasper", speed: 1, urgent };
}

it("runs urgent clips before prefetches and skips dropped ones", async () => {
  const posted = vi.spyOn(self, "postMessage").mockImplementation(() => {});
  const fail = "lantun-test:missing";

  send(synth(1, false));
  send(synth(2, false));
  send(synth(3, true));
  send(synth(4, true));
  send({ type: "drop", keep: [1, 3, 4] });
  // A load that fails makes every queued job report an error, in the order they run.
  send({
    type: "load",
    sources: { model: fail, voices: fail, config: fail, ort: fail, ortWasm: fail, phonemizer: fail },
  });

  function ran(): (number | undefined)[] {
    return posted.mock.calls
      .map(([msg]) => msg as FromWorker)
      .filter((msg) => msg.type === "error" && msg.id !== undefined)
      .map((msg) => (msg.type === "error" ? msg.id : undefined));
  }

  await vi.waitFor(() => expect(ran()).toHaveLength(3));
  expect(ran()).toEqual([3, 4, 1]);
});
