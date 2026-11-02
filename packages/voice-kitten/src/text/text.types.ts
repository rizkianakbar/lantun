export type Phonemize = (text: string) => Promise<string>;

export interface Encoded {
  // Model input: padded token ids.
  ids: number[];
  // For each whitespace-separated word of the text, the index in `ids` of its first token.
  words: number[];
}
