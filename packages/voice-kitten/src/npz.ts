// Minimal .npz reader: a zip of .npy arrays. Kitten ships its voice embeddings this way, and a
// zip library would be most of this package's size, so this reads only what npz files use.

export interface Matrix {
  data: Float32Array;
  rows: number;
  cols: number;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;

const inflate = async (bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> => {
  const body = new Response(bytes).body;
  if (!body) throw new Error("Streams are unavailable");
  return new Uint8Array(
    await new Response(
      body.pipeThrough(new DecompressionStream("deflate-raw")),
    ).arrayBuffer(),
  );
};

export const readZip = async (
  buf: ArrayBuffer,
): Promise<Map<string, Uint8Array>> => {
  const view = new DataView(buf);
  let eocd = buf.byteLength - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== EOCD) eocd--;
  if (eocd < 0) throw new Error("Not a zip file");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== CENTRAL)
      throw new Error("Corrupt zip directory");
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buf, p + 46, nameLen));
    // The local header repeats name and extra field with its own lengths.
    const start =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true);
    const raw = new Uint8Array(buf, start, size);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflate(raw));
    else throw new Error(`Unsupported zip method ${method}`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
};

// .npy: magic, version, header length, a Python dict literal, then the raw little-endian array.
export const readNpy = (bytes: Uint8Array): Matrix => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const v2 = bytes[6] !== undefined && bytes[6] >= 2;
  const headerLen = v2 ? view.getUint32(8, true) : view.getUint16(8, true);
  const offset = (v2 ? 12 : 10) + headerLen;
  const header = new TextDecoder().decode(bytes.subarray(v2 ? 12 : 10, offset));
  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1];
  const shape = (/'shape':\s*\(([^)]*)\)/.exec(header)?.[1] ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map(Number);
  if (/'fortran_order':\s*True/.test(header))
    throw new Error("Fortran-order arrays are not supported");
  // Voice tables are (styles, dims) or (styles, 1, dims): rows are styles, the rest is one row.
  const rows = shape.length > 1 ? (shape[0] ?? 1) : 1;
  const cols = shape.slice(shape.length > 1 ? 1 : 0).reduce((a, b) => a * b, 1);
  // Copy: the array must be 4-byte aligned, which a slice of the zip buffer need not be.
  const body = bytes.slice(offset);
  let data: Float32Array;
  if (descr === "<f4") data = new Float32Array(body.buffer);
  else if (descr === "<f8")
    data = Float32Array.from(new Float64Array(body.buffer));
  else throw new Error(`Unsupported npy dtype ${descr}`);
  return { data, rows, cols };
};

export const readNpz = async (
  buf: ArrayBuffer,
): Promise<Map<string, Matrix>> => {
  const out = new Map<string, Matrix>();
  for (const [name, bytes] of await readZip(buf)) {
    if (name.endsWith(".npy")) out.set(name.slice(0, -4), readNpy(bytes));
  }
  return out;
};
