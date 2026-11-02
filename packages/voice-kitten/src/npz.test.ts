import { describe, expect, it } from "vitest";
import { readNpz } from "./npz";

const npy = (
  rows: number,
  cols: number,
  values: number[],
): Uint8Array<ArrayBuffer> => {
  let header = `{'descr': '<f4', 'fortran_order': False, 'shape': (${rows}, ${cols}), }`;
  // Real npy headers pad to 64 bytes; alignment of the data must not matter to the reader.
  header = header.padEnd(53, " ") + "\n";
  const head = new Uint8Array([
    0x93,
    ...new TextEncoder().encode("NUMPY"),
    1,
    0,
    header.length,
    0,
    ...new TextEncoder().encode(header),
  ]);
  const body = new Uint8Array(new Float32Array(values).buffer);
  const out = new Uint8Array(head.length + body.length);
  out.set(head);
  out.set(body, head.length);
  return out;
};

const deflate = async (bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> =>
  new Uint8Array(
    await new Response(
      new Response(bytes).body?.pipeThrough(
        new CompressionStream("deflate-raw"),
      ),
    ).arrayBuffer(),
  );

// Builds a zip by hand: local headers, then the central directory, then its end record.
const zip = async (
  files: { name: string; data: Uint8Array<ArrayBuffer>; deflated: boolean }[],
): Promise<ArrayBufferLike> => {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const body = f.deflated ? await deflate(f.data) : f.data;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, f.deflated ? 8 : 0, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(10, f.deflated ? 8 : 0, true);
    dir.setUint32(20, body.length, true);
    dir.setUint32(24, f.data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    chunks.push(new Uint8Array(local.buffer), name, body);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const dirSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((at, p) => (out.set(p, at), at + p.length), 0);
  return out.buffer;
};

describe("readNpz", () => {
  it("reads stored and deflated float32 arrays", async () => {
    const buf = await zip([
      {
        name: "expr-voice-2-f.npy",
        data: npy(2, 3, [1, 2, 3, 4, 5, 6]),
        deflated: true,
      },
      { name: "expr-voice-2-m.npy", data: npy(1, 2, [7, 8]), deflated: false },
    ]);
    const voices = await readNpz(buf as ArrayBuffer);
    expect(voices.get("expr-voice-2-f")).toEqual({
      data: new Float32Array([1, 2, 3, 4, 5, 6]),
      rows: 2,
      cols: 3,
    });
    expect(voices.get("expr-voice-2-m")?.data).toEqual(
      new Float32Array([7, 8]),
    );
  });

  it("rejects data that is not a zip", async () => {
    await expect(readNpz(new ArrayBuffer(40))).rejects.toThrow(
      "Not a zip file",
    );
  });
});
