/**
 * physics.js — Modèle de navigation simplifié mais fidèle :
 *  - rendement selon l'angle au vent (près / portant, no-go zone)
 *  - poussée des courants
 *  - vitesse cible = croisière × rendement vent + boost, plafonnée
 */
import { BALANCE } from '../config/balance.js';
import { wrapAngle, clamp } from './mathutils.js';

/**
 * Rendement du vent selon l'angle entre le cap du bateau et la direction FROM du vent.
 * @param heading  cap du bateau (rad)
 * @param windDir  direction VERS laquelle souffle le vent (rad)
 * @returns rendement dans [minEfficiency, maxEfficiency]
 */
export function windEfficiency(heading, windDir) {
  const W = BALANCE.wind;
  // Direction d'où vient le vent :
  const windFrom = wrapAngle(windDir + Math.PI);
  // Angle entre le cap et la provenance du vent : 0 = on fonce dans le vent (mauvais).
  const rel = Math.abs(wrapAngle(heading - windFrom)); // 0..PI
  if (rel < W.noGoAngle) {
    // No-go zone : rendement minimal (il faut tirer des bords)
    const f = rel / W.noGoAngle; // 0..1
    return W.minEfficiency * (0.6 + 0.4 * f);
  }
  if (rel < W.bestReach) {
    // De près serré au largue : montée jusqu'au max
    const f = (rel - W.noGoAngle) / (W.bestReach - W.noGoAngle);
    return W.minEfficiency + (W.maxEfficiency - W.minEfficiency) * Math.sin(f * Math.PI / 2);
  }
  // Du largue au vent arrière : léger repli (le portant pur est un peu moins rapide qu'un largue)
  const f = (rel - W.bestReach) / (Math.PI - W.bestReach);
  return W.maxEfficiency - (W.maxEfficiency - 0.85) * f;
}

/** Vecteur de poussée du courant au point (x,y) pour un parcours donné. */
export function currentAt(course, x, y) {
  let fx = 0, fy = 0;
  const scale = BALANCE.current.strengthScale;
  for (const c of course.currents || []) {
    const dx = x - c.x, dy = y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < c.r) {
      const falloff = 1 - d / c.r; // plus fort au centre
      const s = c.strength * scale * falloff;
      fx += Math.cos(c.dir) * s;
      fy += Math.sin(c.dir) * s;
    }
  }
  return { x: fx, y: fy };
}

/**
 * Calcule la vitesse cible d'un bateau.
 * @param boat  { heading, boostAdd }
 * @param course
 */
export function targetSpeed(boat, course) {
  const B = BALANCE.boat;
  const eff = windEfficiency(boat.heading, course.wind.dir) * (course.wind.strength || 1) * BALANCE.wind.baseStrength;
  let target = B.baseCruise * eff + (boat.boostAdd || 0);
  target = clamp(target, B.minSpeed, B.maxSpeed);
  return target;
}
