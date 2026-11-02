export interface AutoScrollOptions {
  pauseMs?: number;
}

export interface AutoScroll {
  follow(range: Range): void;
  destroy(): void;
}
