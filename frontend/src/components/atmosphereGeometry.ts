/**
 * Perspective projection used by BackgroundAtmosphere.
 *
 * Orbit radii scale with the viewport (`min(width, height) * rxFactor`). On
 * large viewports a tilted orbit swings points to depth `fov + z3 <= 0`, i.e.
 * at or behind the camera. The unguarded `fov / (fov + z3)` then becomes
 * infinite or negative, glow radii go negative, and `createRadialGradient`
 * throws an IndexSizeError that unmounts the whole React tree.
 */

/**
 * Depth of the camera near plane. Points closer than this are projected as if
 * they sat on the plane, which caps the perspective scale at `fov / 100` (4 for
 * the atmosphere's fov of 400). Every point on the default 800x450 layout stays
 * at depth >= 130, so geometry that already rendered correctly is unchanged.
 */
export const NEAR_PLANE_DEPTH = 100;

export interface Projection {
  x: number;
  y: number;
  z: number;
  /** Perspective scale: always finite and > 0. */
  scale: number;
  parallax: number;
}

export function project3D(
  x: number,
  y: number,
  z: number,
  tiltX: number,
  tiltY: number,
  rotateZ: number,
  cx: number,
  cy: number,
  fov: number
): Projection {
  const cosZ = Math.cos(rotateZ);
  const sinZ = Math.sin(rotateZ);
  const x1 = x * cosZ - y * sinZ;
  const y1 = x * sinZ + y * cosZ;

  const cosX = Math.cos(tiltX);
  const sinX = Math.sin(tiltX);
  const y2 = y1 * cosX - z * sinX;
  const z2 = y1 * sinX + z * cosX;

  const cosY = Math.cos(tiltY);
  const sinY = Math.sin(tiltY);
  const x3 = x1 * cosY + z2 * sinY;
  const z3 = -x1 * sinY + z2 * cosY;

  // `>=` rather than Math.max so a NaN depth also falls back to the near plane.
  const depth = fov + z3;
  const scale = fov / (depth >= NEAR_PLANE_DEPTH ? depth : NEAR_PLANE_DEPTH);
  const parallax = z3 / fov;
  return {
    x: cx + x3 * scale,
    y: cy + y2 * scale,
    z: z3,
    scale,
    parallax,
  };
}
