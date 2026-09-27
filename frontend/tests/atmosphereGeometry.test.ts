import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NEAR_PLANE_DEPTH, project3D } from "../src/components/atmosphereGeometry.ts";

const FOV = 400; // BackgroundAtmosphere's fov
const DEG = Math.PI / 180;

// The seven orbit definitions from BackgroundAtmosphere: [rxFactor, ryFactor, tiltX, tiltY].
const ORBITS: [number, number, number, number][] = [
  [0.65, 0.3, 55, 20],
  [0.58, 0.25, -45, 35],
  [0.62, 0.24, 30, -40],
  [0.52, 0.22, 75, 10],
  [0.75, 0.32, -15, -25],
  [0.7, 0.28, 40, 45],
  [0.82, 0.35, 20, -15],
];

/** The pre-fix formula, for comparison. */
function unguardedScale(z3: number): number {
  return FOV / (FOV + z3);
}

/** Sweep every orbit point the way the component does, reporting the projection. */
function* orbitProjections(width: number, height: number) {
  const base = Math.min(width, height);
  for (const [rxF, ryF, tiltX, tiltY] of ORBITS) {
    for (let rot = 0; rot < Math.PI * 2; rot += 0.05) {
      for (let theta = 0; theta < Math.PI * 2; theta += 0.02) {
        // +6 is the maximum curvature offset the component adds to each radius.
        const x = (base * rxF + 6) * Math.cos(theta);
        const y = (base * ryF + 6) * Math.sin(theta);
        yield project3D(x, y, 0, tiltX * DEG, tiltY * DEG, rot, width / 2, height / 2, FOV);
      }
    }
  }
}

describe("atmosphere projection", () => {
  it("reproduces the bug: the unguarded formula goes negative at 1280x800", () => {
    let minUnguarded = Infinity;
    for (const p of orbitProjections(1280, 800)) minUnguarded = Math.min(minUnguarded, unguardedScale(p.z));
    assert.ok(minUnguarded < 0, `expected a negative scale, got ${minUnguarded}`);
  });

  for (const [w, h] of [[800, 450], [1024, 680], [1280, 800], [1440, 900], [1920, 1080], [3840, 2160]]) {
    it(`gives a finite, positive, bounded scale for every orbit point at ${w}x${h}`, () => {
      for (const p of orbitProjections(w, h)) {
        assert.ok(Number.isFinite(p.scale) && p.scale > 0, `bad scale ${p.scale}`);
        assert.ok(p.scale <= FOV / NEAR_PLANE_DEPTH + 1e-9);
        // The glow radius BackgroundAtmosphere passes to createRadialGradient.
        const glowRadius = 1.8 * p.scale * 2.5;
        assert.ok(Number.isFinite(glowRadius) && glowRadius > 0);
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      }
    });
  }

  it("leaves safe geometry unchanged (the whole 800x450 layout)", () => {
    for (const p of orbitProjections(800, 450)) {
      assert.equal(p.scale, unguardedScale(p.z));
    }
  });

  it("clamps points at, behind, or just in front of the camera to the near plane", () => {
    const nearScale = FOV / NEAR_PLANE_DEPTH;
    // Untilted input maps z straight to depth. A point exactly at the camera (fov + z3 = 0):
    const atCamera = project3D(0, 0, -FOV, 0, 0, 0, 0, 0, FOV);
    assert.equal(atCamera.scale, nearScale);
    // A point behind the camera.
    const behind = project3D(0, 0, -2 * FOV, 0, 0, 0, 0, 0, FOV);
    assert.equal(behind.scale, nearScale);
    // Just in front of the camera, inside the near plane (depth 50): was scale 8, now capped.
    assert.equal(project3D(0, 0, 50 - FOV, 0, 0, 0, 0, 0, FOV).scale, nearScale);
    // Just beyond the near plane: untouched.
    assert.equal(project3D(0, 0, 150 - FOV, 0, 0, 0, 0, 0, FOV).scale, FOV / 150);
    // Non-finite input never yields a non-finite scale.
    assert.equal(project3D(0, 0, Number.NaN, 0, 0, 0, 0, 0, FOV).scale, nearScale);
  });

  it("keeps depth and parallax unclamped for the depth-based styling", () => {
    const behind = project3D(0, 0, -2 * FOV, 0, 0, 0, 0, 0, FOV);
    assert.ok(behind.z < -FOV);
    assert.equal(behind.parallax, behind.z / FOV);
  });
});
