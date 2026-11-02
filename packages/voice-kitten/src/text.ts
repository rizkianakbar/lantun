// Text side of Kitten TTS: punctuation-aware phonemisation, the model's symbol table, and word
// timing. Ported from KittenTTS (Apache-2.0), github.com/KittenML/KittenTTS.

const PUNCT = `[${';:,.!?¡¿—…"«»“”()[]{}'.replace(/[\]\\[^-]/g, "\\$&")}]`;

// Symbol order is the model's vocabulary: an index here is a token id.
const SYMBOLS = [
  "$",
  ...';:,.!?¡¿—…"«»"" ',
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  ..."ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ",
];
// Later duplicates win, as in the Python dict this mirrors.
const IDS = new Map(SYMBOLS.map((s, i) => [s, i]));
export const SYMBOL_COUNT = SYMBOLS.length;

// Typographic punctuation the model never saw, mapped to what it did.
export const normalize = (text: string): string =>
  text
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–―]/g, "—")
    .replace(/\s+/g, " ")
    .trim();

// The model rushes the end of text without closing punctuation.
export const ensureEnding = (text: string): string =>
  /[.!?,;:]$/.test(text) ? text : `${text},`;

export type Phonemize = (text: string) => Promise<string>;

// Python's re.findall(r"\w+|[^\w\s]") with Unicode \w, then joined by spaces.
const TOKENS = /[\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_\s]/gu;
// A word's leading punctuation, its pronounceable core, and its trailing punctuation.
const EDGES = new RegExp(`^(${PUNCT}*)(.*?)(${PUNCT}*)$`, "su");
const SPACE = IDS.get(" ") as number;

// Token ids for a phoneme string, without padding.
export const tokenIds = (piece: string): number[] => {
  const out: number[] = [];
  for (const ch of (piece.match(TOKENS) ?? []).join(" ")) {
    const id = IDS.get(ch);
    if (id !== undefined) out.push(id);
  }
  return out;
};

export interface Encoded {
  // Model input: padded token ids.
  ids: number[];
  // For each whitespace-separated word of the text, the index in `ids` of its first token.
  words: number[];
}

// Which phoneme words belong to which text word. espeak usually returns one per word, but
// numbers and abbreviations expand ("42" -> "forty two"); then they are shared out in proportion
// to each word's length, which keeps the order and stays close.
export const assign = (
  words: readonly string[],
  phonemeWords: number,
): number[] => {
  if (words.length === phonemeWords) return words.map((_, i) => i);
  const weights = words.map((w) => Math.max(1, w.length));
  const total = weights.reduce((a, b) => a + b, 0);
  const owner: number[] = [];
  let word = 0;
  let upTo = weights[0] ?? 0;
  for (let k = 0; k < phonemeWords; k++) {
    const at = ((k + 0.5) / phonemeWords) * total;
    while (at > upTo && word < words.length - 1) upTo += weights[++word] ?? 0;
    owner.push(word);
  }
  return owner;
};

// Phonemises each run of words between punctuation in one call, as KittenTTS does: espeak needs
// the neighbouring words to pick weak forms ("the" as /ðə/, "to" as /tə/) and natural stress.
// Phonemised alone, every word came out stressed, in its dictionary form, and the voice read word
// by word. Punctuation is kept as-is; it drives the model's pauses and intonation. Each text
// word's tokens are tracked, so the model's per-token durations time every word.
export const encode = async (
  text: string,
  phonemize: Phonemize,
): Promise<Encoded> => {
  const raw = text.match(/\S+/g) ?? [];
  const split = raw.map((word, i) => {
    const [, lead = "", core = "", trail = ""] =
      EDGES.exec(normalize(i === raw.length - 1 ? ensureEnding(word) : word)) ??
      [];
    return { lead, core, trail };
  });
  // Phonemes per text word, filled run by run.
  const phonemes: string[] = split.map(() => "");
  let run: number[] = [];
  const flush = async (): Promise<void> => {
    const cores = run.filter((i) => split[i]?.core);
    run = [];
    if (!cores.length) return;
    const out = (await phonemize(cores.map((i) => split[i]?.core).join(" ")))
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const owner = assign(
      cores.map((i) => split[i]?.core ?? ""),
      out.length,
    );
    out.forEach((ph, k) => {
      const i = cores[owner[k] ?? 0] ?? 0;
      phonemes[i] = phonemes[i] ? `${phonemes[i]} ${ph}` : ph;
    });
  };
  for (const [i, w] of split.entries()) {
    if (w.lead) await flush();
    run.push(i);
    if (w.trail) await flush();
  }
  await flush();

  const ids = [0];
  const words: number[] = [];
  for (const [i, w] of split.entries()) {
    const piece = tokenIds(w.lead + (phonemes[i] ?? "") + w.trail);
    if (piece.length && ids.length > 1) ids.push(SPACE);
    words.push(ids.length);
    ids.push(...piece);
  }
  ids.push(10, 0);
  return { ids, words };
};

// Seconds from clip start to each word, from the model's per-token durations (in frames).
export const wordStarts = (
  words: readonly number[],
  durations: ArrayLike<number | bigint>,
  secondsPerFrame: number,
): Float32Array<ArrayBuffer> => {
  const before = new Float64Array(durations.length + 1);
  for (let i = 0; i < durations.length; i++)
    before[i + 1] = (before[i] ?? 0) + Number(durations[i]);
  const out = new Float32Array(words.length);
  words.forEach(
    (t, i) =>
      (out[i] = (before[Math.min(t, durations.length)] ?? 0) * secondsPerFrame),
  );
  return out;
};
