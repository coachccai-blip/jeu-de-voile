/**
 * ai.js — IA des 4 bots.
 *  - Trajectoire TOUJOURS valide : ils visent la prochaine bouée (+ petit bruit naturel).
 *  - Ils "répondent" à des questions à intervalle ~ botSpeed : succès selon botSkill.
 *    Une réussite = boost (comme le joueur) ; un échec = pas de boost.
 */
import { BALANCE } from '../config/balance.js';
import { wrapAngle } from './mathutils.js';

export class BotController {
  constructor(boat, difficulty) {
    this.boat = boat;
    this.difficulty = difficulty;
    // décalage individuel pour désynchroniser les bots
    this.timer = 0.8 + Math.random() * difficulty.botSpeed;
    this.noisePhase = Math.random() * 100;
  }

  update(dt, course, marks) {
    const boat = this.boat;
    if (boat.finished) return;

    // --- Cap : viser la prochaine bouée avec un léger biais stratégique ---
    const mark = marks[boat.nextMark];
    if (mark) {
      const dx = mark.x - boat.x, dy = mark.y - boat.y;
      let aim = Math.atan2(dy, dx);
      // Bruit doux pour paraître naturel + gérer le près (approche en biais)
      this.noisePhase += dt;
      const noise = Math.sin(this.noisePhase * 1.3) * BALANCE.ai.steerNoise;
      boat.targetHeading = wrapAngle(aim + noise);
    }

    // --- Simulation de réponses ---
    this.timer -= dt;
    if (this.timer <= 0) {
      const d = this.difficulty;
      const jitter = (Math.random() - 0.5) * 2 * BALANCE.ai.reactionJitter;
      this.timer = Math.max(0.6, d.botSpeed + jitter);

      const success = Math.random() < d.botSkill;
      if (success) {
        // Vitesse de réponse simulée -> force du boost (continue)
        const replyFrac = Math.random(); // 0 = très rapide
        const bst = BALANCE.boost;
        const add = bst.minAdd + (bst.maxAdd - bst.minAdd) * (1 - replyFrac) * 0.85;
        const dur = bst.minDuration + (bst.maxDuration - bst.minDuration) * (1 - replyFrac);
        boat.boostAdd = Math.max(boat.boostAdd, add);
        boat.boostTimer = dur;
        boat.desiredSpeedMul = 1.1;
        boat.failStreak = 0;
      } else {
        boat.failStreak++;
        boat.desiredSpeedMul = 1.0;
        const S = BALANCE.splashdown;
        if (boat.failStreak >= S.failThreshold + 1 &&
            boat.speed / BALANCE.boat.maxSpeed < S.nearMinRatio) {
          boat.triggerSplashdown();
        }
      }
    }
  }
}
