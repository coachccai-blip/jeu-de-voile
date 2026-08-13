/** mathutils.js — Petites fonctions math partagées. */
export const TAU = Math.PI * 2;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

/** Normalise un angle dans [-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/** Différence angulaire signée la plus courte de a vers b. */
export function angleDiff(a, b) { return wrapAngle(b - a); }

/** Fait tourner `cur` vers `target` d'au plus `maxStep`. */
export function approachAngle(cur, target, maxStep) {
  const d = angleDiff(cur, target);
  if (Math.abs(d) <= maxStep) return target;
  return wrapAngle(cur + Math.sign(d) * maxStep);
}

export function moveToward(cur, target, maxStep) {
  const d = target - cur;
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}
