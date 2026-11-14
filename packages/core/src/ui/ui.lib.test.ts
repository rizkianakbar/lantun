import { describe, expect, it } from "vitest";
import { RUBBER_PX } from "./ui.constants";
import { flingDock, releaseVelocity, rubberBand } from "./ui.lib";

describe("rubberBand", () => {
  it("follows freely inside the bounds and with growing resistance past them", () => {
    expect(rubberBand(50, 12, 100)).toBe(50);
    const a = rubberBand(-20, 12, 100);
    const b = rubberBand(-200, 12, 100);
    expect(a).toBeLessThan(12);
    expect(12 - a).toBeLessThan(32);
    expect(12 - b).toBeLessThan(RUBBER_PX);
    expect(rubberBand(140, 12, 100)).toBeGreaterThan(100);
  });
});

describe("releaseVelocity", () => {
  const moves = [
    { t: 0, x: 500, y: 300 },
    { t: 16, x: 460, y: 300 },
    { t: 32, x: 400, y: 300 },
  ];

  it("measures a flick from the last moves", () => {
    const { vx, vy } = releaseVelocity(moves, 40);
    expect(vx).toBeCloseTo(-100 / 32);
    expect(vy).toBe(0);
  });

  it("has none when the pointer stopped before letting go", () => {
    expect(releaseVelocity(moves, 200)).toEqual({ vx: 0, vy: 0 });
  });

  it("throws the dock to the edge a flick heads for, and leaves a slow drop where it is", () => {
    const v = releaseVelocity(moves, 40);
    expect(flingDock(700, 300, v, "v", 1280, 800)).toEqual({ x: 0, y: 0.375, o: "v" });
    expect(flingDock(700, 300, { vx: 0, vy: 1 }, "v", 1280, 800)).toMatchObject({ y: 1, o: "h" });
    expect(flingDock(700, 300, { vx: -0.2, vy: 0 }, "v", 1280, 800)).toEqual({ x: 700 / 1280, y: 0.375, o: "v" });
  });
});
