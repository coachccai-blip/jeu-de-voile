/**
 * entities.js — Le bateau (F50) : état + intégration physique.
 */
import { BALANCE } from '../config/balance.js';
import { targetSpeed, currentAt } from './physics.js';
import { approachAngle, moveToward, clamp } from './mathutils.js';

export class Boat {
  constructor(team, isPlayer, start) {
    this.team = team;
    this.isPlayer = isPlayer;
    this.x = start.x;
    this.y = start.y;
    this.heading = start.angle;
    this.targetHeading = start.angle;
    this.waypoint = null;       // point du monde à atteindre précisément (manœuvre joueur)
    this.speed = BALANCE.boat.minSpeed;
    this.desiredSpeedMul = 1;   // intention de vitesse [0.6..1.2] fixée par la manœuvre
    this.boostAdd = 0;
    this.boostTimer = 0;
    this.splashTimer = 0;
    this.failStreak = 0;
    this.nextMark = 0;          // index de la prochaine bouée à virer
    this.lap = 0;
    this.finished = false;
    this.finishTime = 0;
    this.progress = 0;          // score de progression pour le classement
    // visuel
    this.wake = [];             // points de sillage
    this.foiling = false;
    this.rank = 1;
    this.name = team.name;
    this.heel = 0;              // gîte visuelle
  }

  /**
   * Applique le résultat d'une manœuvre réussie : cap vers un point précis + boost.
   * @param waypoint {x,y} point du monde que le bateau doit traverser (ou null)
   */
  applyManeuver(waypoint, speedMul, boostAdd, boostDuration) {
    if (waypoint) {
      this.waypoint = { x: waypoint.x, y: waypoint.y };
      this.targetHeading = Math.atan2(waypoint.y - this.y, waypoint.x - this.x);
    }
    this.desiredSpeedMul = clamp(speedMul, 0.6, 1.2);
    if (boostAdd > 0) {
      this.boostAdd = Math.max(this.boostAdd, boostAdd);
      this.boostTimer = boostDuration;
    }
  }

  triggerSplashdown() {
    const S = BALANCE.splashdown;
    this.splashTimer = S.duration;
    this.boostAdd = 0;
    this.boostTimer = 0;
    this.speed *= S.speedPenalty;
    this.failStreak = 0;
  }

  update(dt, course) {
    const B = BALANCE.boat;

    // --- Navigation vers le point cliqué (passe précisément par ce pixel) ---
    if (this.waypoint) {
      const dx = this.waypoint.x - this.x, dy = this.waypoint.y - this.y;
      const d = Math.hypot(dx, dy);
      const arrive = Math.max(14, this.speed * dt * 1.5);
      if (d <= arrive) {
        this.waypoint = null; // atteint : on garde le cap courant et on file tout droit
      } else {
        this.targetHeading = Math.atan2(dy, dx);
      }
    }

    // --- Rotation vers le cap visé ---
    this.heading = approachAngle(this.heading, this.targetHeading, B.turnRate * dt);
    // gîte visuelle proportionnelle à l'écart de cap
    const desiredHeel = clamp((this.targetHeading - this.heading) * 1.5, -0.5, 0.5);
    this.heel += (desiredHeel - this.heel) * Math.min(1, dt * 6);

    // --- Boost decay (échelle continue) ---
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) { this.boostTimer = 0; }
    } else if (this.boostAdd > 0) {
      this.boostAdd = Math.max(0, this.boostAdd - BALANCE.boost.decayPerSec * dt);
    }

    // --- Vitesse cible ---
    let tgt = targetSpeed(this, course) * this.desiredSpeedMul;
    if (this.splashTimer > 0) {
      this.splashTimer -= dt;
      tgt = Math.min(tgt, B.minSpeed * 1.1); // bridé pendant la chute
    }
    tgt = clamp(tgt, B.minSpeed, B.maxSpeed);

    const rate = tgt > this.speed ? B.accel : B.decel;
    this.speed = moveToward(this.speed, tgt, rate * dt);

    // --- Déplacement ---
    let vx = Math.cos(this.heading) * this.speed;
    let vy = Math.sin(this.heading) * this.speed;
    const cur = currentAt(course, this.x, this.y);
    vx += cur.x; vy += cur.y;
    this.x += vx * dt;
    this.y += vy * dt;

    // Garder dans le monde (rebond doux)
    const m = 40;
    if (this.x < m) { this.x = m; }
    if (this.x > BALANCE.world.width - m) { this.x = BALANCE.world.width - m; }
    if (this.y < m) { this.y = m; }
    if (this.y > BALANCE.world.height - m) { this.y = BALANCE.world.height - m; }

    // --- État foils ---
    this.foiling = this.speed / B.maxSpeed > B.foilingThreshold && this.splashTimer <= 0;

    // --- Sillage ---
    this.wake.push({ x: this.x, y: this.y, life: 1 });
    if (this.wake.length > 60) this.wake.shift();
    for (const w of this.wake) w.life -= dt * 0.7;
    while (this.wake.length && this.wake[0].life <= 0) this.wake.shift();
  }

  speedKnots() {
    // Conversion arbitraire mais cohérente pour l'affichage télémétrie.
    return this.speed / BALANCE.boat.maxSpeed * 52; // ~52 nds max (F50)
  }
}
