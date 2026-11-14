export type Lang = "html" | "ts" | "tsx" | "sh";

// Mirrors VS Code's Dark+ scopes; "b1"–"b3" are its bracket-pair colours by depth.
export type TokenKind =
  | "keyword"
  | "storage"
  | "fn"
  | "string"
  | "tag"
  | "type"
  | "attr"
  | "var"
  | "punct"
  | "b1"
  | "b2"
  | "b3";

export interface Token {
  text: string;
  kind?: TokenKind;
}

// A sticky pattern and the kind of each capture group (or of the whole match when it has none).
export type Rule = [RegExp, ...TokenKind[]];
