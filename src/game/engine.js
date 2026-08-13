/**
 * engine.js — Moteur de course : simulation, rendu Canvas 2D, machine à états
 * de la manœuvre (Manœuvrer → QCM → cap), classement et détection d'arrivée.
 *
 * L'UI (HUD/QCM) communique par callbacks (engine.callbacks) et par appels
 * (pressManeuver / submitAnswer / confirmAim). Le moteur reste la source de vérité.
 */
import { BALANCE, difficultyFromSlider } from '../config/balance.js';
import { Boat } from './entities.js';
import { BotController } from './ai.js';
import { getBank } from '../data/questionBank.js';
import { currentAt } from './physics.js';
import { TEAMS, PLAYER_TEAM_INDEX } from '../data/courses.js';
import { clamp, dist, wrapAngle } from './mathutils.js';
import { audio } from '../audio/audio.js';

const PHASE = { PRESTART: 'prestart', RACING: 'racing', FINISHED: 'finished' };
const MAN = { NONE: 'none', QUESTION: 'question', AIMING: 'aiming' };

export class RaceEngine {
  constructor(canvas, course, sliderValue, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.course = course;
    this.difficulty = difficultyFromSlider(sliderValue);
    this.bank = getBank(course.bankKey || 'math-proc');
    this.callbacks = {};
    this.tutorial = !!opts.tutorial;

    this.phase = PHASE.PRESTART;
    this.man = MAN.NONE;
    this.raceClock = 0;
    this.countdown = BALANCE.race.countdownFrom;
    this._lastBeep = Math.ceil(this.countdown);

    this.cooldown = 0;
    this.pendingBoost = null;
    this.currentQuestion = null;
    this.qStartClock = 0;

    this.aimPreview = null; // {heading, mul}
    this.time = 0;
    this.running = false;
    this.paused = false;

    // Stats joueur
    this.stats = { questions: 0, correct: 0, bestReplyMs: Infinity, topSpeedKnots: 0 };

    this._buildCheckpoints();
    this._buildBoats();
    this._buildWindParticles();
    this._bindPointer();
    this.resize();
  }

  // ---------- Construction ----------
  _buildCheckpoints() {
    const laps = BALANCE.race.laps;
    const cps = [];
    for (let l = 0; l < laps; l++) {
      for (const m of this.course.marks) cps.push({ ...m, finish: false });
    }
    const s = this.course.start;
    cps.push({ x: s.x, y: s.y, label: 'Arrivée', finish: true });
    this.checkpoints = cps;
    this.startLine = this._lineFrom(s.x, s.y, s.angle, 220);
  }

  _lineFrom(x, y, angle, half) {
    // ligne perpendiculaire au cap de départ
    const px = Math.cos(angle + Math.PI / 2), py = Math.sin(angle + Math.PI / 2);
    return { ax: x - px * half, ay: y - py * half, bx: x + px * half, by: y + py * half, x, y };
  }

  _buildBoats() {
    const s = this.course.start;
    const px = Math.cos(s.angle + Math.PI / 2), py = Math.sin(s.angle + Math.PI / 2);
    const back = Math.cos(s.angle + Math.PI), backY = Math.sin(s.angle + Math.PI);
    this.boats = [];
    this.bots = [];
    // Répartir les 5 bateaux le long de la ligne, derrière elle
    for (let i = 0; i < TEAMS.length; i++) {
      const off = (i - (TEAMS.length - 1) / 2) * 90;
      const start = {
        x: s.x + px * off + back * 70,
        y: s.y + py * off + backY * 70,
        angle: s.angle,
      };
      const isPlayer = i === PLAYER_TEAM_INDEX;
      const boat = new Boat(TEAMS[i], isPlayer, start);
      this.boats.push(boat);
      if (isPlayer) this.player = boat;
      else this.bots.push(new BotController(boat, this.difficulty));
    }
  }

  _buildWindParticles() {
    this.windParticles = [];
    for (let i = 0; i < 90; i++) {
      this.windParticles.push({
        x: Math.random() * BALANCE.world.width,
        y: Math.random() * BALANCE.world.height,
        len: 8 + Math.random() * 22,
        spd: 60 + Math.random() * 90,
      });
    }
  }

  // ---------- Boucle ----------
  start() {
    this.running = true;
    this._last = null;
    audio.startWind();
    audio.playMusic('race');
    const loop = (ts) => {
      if (!this.running) return;
      if (this._last == null) this._last = ts;
      let dt = (ts - this._last) / 1000;
      this._last = ts;
      dt = Math.min(dt, 0.05); // clamp anti-saut
      if (!this.paused) this.update(dt);
      this.render();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    audio.stopWind();
    if (this._pointerCleanup) this._pointerCleanup();
  }

  setPaused(p) { this.paused = p; this._last = null; }

  // ---------- Update ----------
  update(dt) {
    this.time += dt;

    if (this.phase === PHASE.PRESTART) {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c < this._lastBeep && c >= 0) {
        this._lastBeep = c;
        if (c > 0) { audio.sfx('countBeep'); this._emit('onCountdown', String(c)); }
      }
      if (this.countdown <= 0) {
        this.phase = PHASE.RACING;
        audio.sfx('go');
        this._emit('onCountdown', 'GO');
      }
      // Les bateaux dérivent lentement derrière la ligne
      for (const b of this.boats) b.update(dt, this.course);
      this._updateWind(dt);
      return;
    }

    if (this.phase === PHASE.RACING) {
      // Ralenti « bullet-time » : le monde tourne au ralenti PENDANT la question,
      // et repasse à 1× dès que le joueur choisit son cap (phase AIMING).
      const sdt = dt * this.timeScale;
      this.raceClock += sdt;
      if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - sdt);

      // Question chronométrée (source de vérité = horloge sim)
      if (this.man === MAN.QUESTION && this.currentQuestion) {
        const elapsed = this.raceClock - this.qStartClock;
        const tl = this.currentQuestion.timeLimit;
        const remaining = Math.max(0, tl - elapsed);
        this._emit('onQuestionTick', remaining, remaining / tl);
        // tic-tac sur la fin
        if (remaining < 3) {
          const s = Math.ceil(remaining);
          if (s !== this._lastTick) { this._lastTick = s; if (s > 0) audio.sfx('tick'); }
        }
        if (elapsed >= tl) this._resolveAnswer(-1, true);
      }

      // Bots
      for (const bc of this.bots) bc.update(sdt, this.course, this.checkpoints);

      // Physique + checkpoints
      for (const b of this.boats) {
        const prevSplash = b.splashTimer > 0;
        b.update(sdt, this.course);
        this._checkCheckpoint(b);
        if (b === this.player) {
          const k = b.speedKnots();
          if (k > this.stats.topSpeedKnots) this.stats.topSpeedKnots = k;
          if (!prevSplash && b.splashTimer > 0) this._emit('onFeedback', 'splash');
        }
      }

      this._computeRanks();
      this._updateWind(sdt);
      audio.setWindIntensity(clamp(this.player.speed / BALANCE.boat.maxSpeed, 0, 1));

      // HUD
      this._emitHud();

      // Fin de course pour le joueur
      if (this.player.finished && this.phase !== PHASE.FINISHED) {
        this._finishRace();
      }
    }
  }

  _updateWind(dt) {
    const wd = this.course.wind.dir;
    const vx = Math.cos(wd), vy = Math.sin(wd);
    for (const p of this.windParticles) {
      p.x += vx * p.spd * dt;
      p.y += vy * p.spd * dt;
      if (p.x < 0) p.x += BALANCE.world.width;
      if (p.x > BALANCE.world.width) p.x -= BALANCE.world.width;
      if (p.y < 0) p.y += BALANCE.world.height;
      if (p.y > BALANCE.world.height) p.y -= BALANCE.world.height;
    }
  }

  _checkCheckpoint(b) {
    if (b.finished) return;
    const cp = this.checkpoints[b.nextMark];
    if (!cp) return;
    const r = cp.finish ? BALANCE.race.buoyRadius * 3 : BALANCE.race.buoyRadius + BALANCE.boat.length * 0.4;
    if (dist(b.x, b.y, cp.x, cp.y) < r) {
      b.nextMark++;
      if (cp.finish) {
        b.finished = true;
        b.finishTime = this.raceClock;
        if (b === this.player) { audio.sfx('finish'); this._emit('onFeedback', 'finish'); }
      } else if (b === this.player) {
        audio.sfx('buoy');
        this._emit('onFeedback', 'buoy');
      }
    }
  }

  _computeRanks() {
    const score = (b) => {
      if (b.finished) return 1e12 - b.finishTime; // finis d'abord, plus tôt = mieux
      const cp = this.checkpoints[b.nextMark];
      const d = cp ? dist(b.x, b.y, cp.x, cp.y) : 0;
      return b.nextMark * 100000 - d;
    };
    const sorted = [...this.boats].sort((a, b) => score(b) - score(a));
    sorted.forEach((b, i) => (b.rank = i + 1));
  }

  // ---------- Manœuvre : machine à états ----------
  get timeScale() {
    // Ralenti uniquement pendant la question ; 1× dès le choix du cap.
    return this.man === MAN.QUESTION ? BALANCE.maneuver.questionTimeScale : 1;
  }

  canManeuver() {
    return this.phase === PHASE.RACING && this.man === MAN.NONE && this.cooldown <= 0 && !this.player.finished;
  }

  pressManeuver() {
    if (!this.canManeuver()) return false;
    const q = this.bank.getNextQuestion(this.difficulty);
    if (!q) return false;
    this.currentQuestion = q;
    this.man = MAN.QUESTION;
    this.qStartClock = this.raceClock;
    this._lastTick = null;
    audio.sfx('qcmOpen');
    this._emit('onQuestionShow', { prompt: q.prompt, choices: q.choices, timeLimit: q.timeLimit });
    return true;
  }

  submitAnswer(index) {
    if (this.man !== MAN.QUESTION) return;
    this._resolveAnswer(index, false);
  }

  _resolveAnswer(index, timedOut) {
    const q = this.currentQuestion;
    const elapsed = this.raceClock - this.qStartClock;
    const correct = !timedOut && index === q.correctIndex;
    this.stats.questions++;
    this._emit('onQuestionResult', correct, index, q.correctIndex, timedOut);

    if (correct) {
      this.stats.correct++;
      const replyMs = elapsed * 1000;
      if (replyMs < this.stats.bestReplyMs) this.stats.bestReplyMs = replyMs;
      // Boost continu : plus la réponse est rapide, plus il est fort/long.
      const frac = clamp(elapsed / q.timeLimit, 0, 1); // 0 = instantané
      const bst = BALANCE.boost;
      const speedFactor = 1 - frac;
      const add = bst.minAdd + (bst.maxAdd - bst.minAdd) * speedFactor;
      const dur = bst.minDuration + (bst.maxDuration - bst.minDuration) * speedFactor;
      this.pendingBoost = { add, dur };
      this.player.failStreak = 0;
      audio.sfx('correct');
      // Passage en phase de choix de cap
      this.man = MAN.AIMING;
      this.currentQuestion = null;
      this.aimPreview = { heading: this.player.heading, mul: 1 };
      this._emit('onAimStart');
    } else {
      // Mauvaise réponse : pas de boost, trajectoire conservée, cooldown = pénalité.
      audio.sfx('wrong');
      this.player.failStreak++;
      const S = BALANCE.splashdown;
      if (this.player.failStreak >= S.failThreshold &&
          this.player.speed / BALANCE.boat.maxSpeed < S.nearMinRatio) {
        this.player.triggerSplashdown();
        this._emit('onFeedback', 'splash');
      }
      this._endManeuver();
    }
  }

  /** Prévisualise le cap depuis un point écran (la flèche suit la souris). */
  previewAim(sx, sy) {
    if (this.man !== MAN.AIMING) return;
    const w = this.screenToWorld(sx, sy);
    const dx = w.x - this.player.x, dy = w.y - this.player.y;
    const heading = Math.atan2(dy, dx);
    const d = Math.hypot(dx, dy);
    const mul = clamp(0.7 + d / 600, 0.7, 1.2); // loin = intention de vitesse plus forte
    // On mémorise le POINT MONDE exact visé : le bateau devra passer par ce pixel.
    this.aimPreview = { heading, mul, point: { x: w.x, y: w.y } };
  }

  confirmAim(sx, sy) {
    if (this.man !== MAN.AIMING) return;
    if (sx !== undefined) this.previewAim(sx, sy);
    const p = this.aimPreview || { heading: this.player.heading, mul: 1, point: null };
    const b = this.pendingBoost || { add: 0, dur: 0 };
    this.player.applyManeuver(p.point, p.mul, b.add, b.dur);
    if (b.add > 0) { audio.sfx('boost'); this._emit('onFeedback', 'boost'); }
    if (this.player.foiling) this._emit('onFeedback', 'foiling');
    this.pendingBoost = null;
    this._endManeuver();
  }

  _endManeuver() {
    this.man = MAN.NONE;
    this.currentQuestion = null;
    this.aimPreview = null;
    this.cooldown = BALANCE.maneuver.cooldown;
    this._emit('onManeuverEnd');
  }

  _finishRace() {
    this.phase = PHASE.FINISHED;
    // Laisser les bots finir instantanément pour le classement
    const results = this._compileResults();
    const won = results[0].isPlayer;
    audio.sfx(won ? 'victory' : 'defeat');
    setTimeout(() => this._emit('onFinish', results, won), 900);
  }

  _compileResults() {
    // Estime un temps d'arrivée pour les bots non finis (pour le classement final).
    const est = (b) => {
      if (b.finished) return b.finishTime;
      const cp = this.checkpoints[b.nextMark];
      let remain = cp ? dist(b.x, b.y, cp.x, cp.y) : 0;
      for (let i = b.nextMark + 1; i < this.checkpoints.length; i++) {
        remain += dist(this.checkpoints[i - 1].x, this.checkpoints[i - 1].y, this.checkpoints[i].x, this.checkpoints[i].y);
      }
      return this.raceClock + remain / Math.max(40, b.speed);
    };
    return [...this.boats]
      .map(b => ({ boat: b, name: b.name, color: b.team.color, isPlayer: b.isPlayer, time: est(b) }))
      .sort((a, b) => a.time - b.time);
  }

  // ---------- Rendu ----------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.dpr = dpr;
    this.viewW = w; this.viewH = h;
    // zoom : viser ~1500 unités visibles en largeur, adapté au mobile
    this.zoom = clamp(w / 1500, 0.35, 0.9);
  }

  _camera() {
    const cx = this.player.x, cy = this.player.y;
    return { cx, cy, zoom: this.zoom };
  }

  worldToScreen(wx, wy) {
    const { cx, cy, zoom } = this._camera();
    return { x: (wx - cx) * zoom + this.viewW / 2, y: (wy - cy) * zoom + this.viewH / 2 };
  }
  screenToWorld(sx, sy) {
    const { cx, cy, zoom } = this._camera();
    return { x: (sx - this.viewW / 2) / zoom + cx, y: (sy - this.viewH / 2) / zoom + cy };
  }

  render() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    this._drawWater(ctx);
    this._drawCurrents(ctx);
    this._drawWind(ctx);
    this._drawStartLine(ctx);
    this._drawCheckpoints(ctx);
    for (const b of this.boats) this._drawWake(ctx, b);
    for (const b of this.boats) if (!b.isPlayer) this._drawBoat(ctx, b);
    this._drawBoat(ctx, this.player);
    if (this.man === MAN.AIMING) this._drawAim(ctx);
    this._drawNextBuoyArrow(ctx);
    this._drawMinimap(ctx);
  }

  _drawWater(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.viewH);
    g.addColorStop(0, '#0a3a63');
    g.addColorStop(0.5, '#0c4d7a');
    g.addColorStop(1, '#08324f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // scintillement / houle
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#bfe6ff';
    ctx.lineWidth = 1;
    const { zoom } = this._camera();
    const spacing = 70 * zoom;
    const off = (this.time * 18 * zoom) % spacing;
    for (let y = -spacing + off; y < this.viewH; y += spacing) {
      ctx.beginPath();
      for (let x = 0; x <= this.viewW; x += 24) {
        const yy = y + Math.sin((x * 0.02) + this.time * 1.5) * 4;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawCurrents(ctx) {
    for (const c of this.course.currents || []) {
      const s = this.worldToScreen(c.x, c.y);
      const r = c.r * this.zoom;
      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      grd.addColorStop(0, 'rgba(60,220,200,0.12)');
      grd.addColorStop(1, 'rgba(60,220,200,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
      // flèches de courant
      ctx.save();
      ctx.strokeStyle = 'rgba(120,255,235,0.35)';
      ctx.lineWidth = 2;
      const dirx = Math.cos(c.dir), diry = Math.sin(c.dir);
      const flow = (this.time * 40) % 60;
      for (let ring = 0.35; ring < 1; ring += 0.32) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
          const bx = c.x + Math.cos(a) * c.r * ring + dirx * flow;
          const by = c.y + Math.sin(a) * c.r * ring + diry * flow;
          const p1 = this.worldToScreen(bx, by);
          const p2 = this.worldToScreen(bx + dirx * 22, by + diry * 22);
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  _drawWind(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(230,245,255,0.25)';
    ctx.lineWidth = 1.5;
    const dx = Math.cos(this.course.wind.dir), dy = Math.sin(this.course.wind.dir);
    for (const p of this.windParticles) {
      const s = this.worldToScreen(p.x, p.y);
      if (s.x < -30 || s.x > this.viewW + 30 || s.y < -30 || s.y > this.viewH + 30) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + dx * p.len * this.zoom, s.y + dy * p.len * this.zoom);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawStartLine(ctx) {
    const l = this.startLine;
    const a = this.worldToScreen(l.ax, l.ay);
    const b = this.worldToScreen(l.bx, l.by);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    // bouées de ligne
    for (const p of [a, b]) {
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawCheckpoints(ctx) {
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      if (cp.finish) continue;
      const s = this.worldToScreen(cp.x, cp.y);
      const isNext = i === this.player.nextMark;
      const passed = i < this.player.nextMark;
      const r = BALANCE.race.buoyRadius * this.zoom;
      // bouée
      ctx.beginPath();
      ctx.fillStyle = passed ? 'rgba(255,255,255,0.25)' : (isNext ? '#ffd43b' : '#ff9f43');
      ctx.arc(s.x, s.y, Math.max(6, r * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
      if (isNext) {
        // anneau pulsant
        const pulse = 1 + Math.sin(this.time * 4) * 0.12;
        ctx.strokeStyle = 'rgba(255,212,59,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.2 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,212,59,0.9)';
        ctx.font = `${Math.max(11, 12 * this.zoom + 6)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(cp.label || '', s.x, s.y - r * 1.5 - 4);
      }
    }
  }

  _drawWake(ctx, b) {
    if (b.wake.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < b.wake.length; i++) {
      const w0 = b.wake[i - 1], w1 = b.wake[i];
      const p0 = this.worldToScreen(w0.x, w0.y);
      const p1 = this.worldToScreen(w1.x, w1.y);
      const life = w1.life;
      ctx.strokeStyle = `rgba(220,245,255,${0.28 * life})`;
      ctx.lineWidth = (b.foiling ? 7 : 4) * life * this.zoom + 1;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.restore();
  }

  _drawBoat(ctx, b) {
    const s = this.worldToScreen(b.x, b.y);
    const L = BALANCE.boat.length * this.zoom;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(b.heading);

    // spray foils si vol
    if (b.foiling) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 5; i++) {
        const sx = -L * 0.5 - Math.random() * L * 0.6;
        const sy = (Math.random() - 0.5) * L * 0.8;
        ctx.beginPath(); ctx.arc(sx, sy, 1.5 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // coque catamaran (deux flotteurs)
    ctx.fillStyle = b.team.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    const hw = L * 0.16;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(L * 0.5, side * hw * 0.6);
      ctx.lineTo(-L * 0.45, side * hw);
      ctx.lineTo(-L * 0.45, side * hw * 0.2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // plateforme
    ctx.fillStyle = 'rgba(20,30,40,0.55)';
    ctx.fillRect(-L * 0.4, -hw, L * 0.75, hw * 2);

    // aile/voile (inclinée par la gîte)
    ctx.save();
    ctx.rotate(b.heel * 0.15);
    const sailGrad = ctx.createLinearGradient(0, -hw, 0, hw);
    sailGrad.addColorStop(0, b.team.sail);
    sailGrad.addColorStop(1, 'rgba(255,255,255,0.5)');
    ctx.fillStyle = sailGrad;
    ctx.beginPath();
    ctx.moveTo(L * 0.15, 0);
    ctx.lineTo(-L * 0.2, -hw * 1.8);
    ctx.lineTo(-L * 0.28, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
    ctx.restore();

    ctx.restore();

    // halo joueur + étiquette
    if (b.isPlayer) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120,220,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, L * 0.9, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // pastille rang
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(s.x + L * 0.7, s.y - L * 0.7, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.team.color;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(b.rank), s.x + L * 0.7, s.y - L * 0.7);
    ctx.restore();
  }

  _drawAim(ctx) {
    const p = this.aimPreview;
    if (!p) return;
    const s = this.worldToScreen(this.player.x, this.player.y);
    const len = 90 + p.mul * 60;
    const ex = s.x + Math.cos(p.heading) * len;
    const ey = s.y + Math.sin(p.heading) * len;
    ctx.save();
    // rose des caps
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, len, 0, Math.PI * 2); ctx.stroke();
    // flèche de cap
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.translate(ex, ey); ctx.rotate(p.heading);
    ctx.moveTo(0, 0); ctx.lineTo(-14, -7); ctx.lineTo(-14, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _drawNextBuoyArrow(ctx) {
    const cp = this.checkpoints[this.player.nextMark];
    if (!cp) return;
    const s = this.worldToScreen(cp.x, cp.y);
    const margin = 60;
    if (s.x > margin && s.x < this.viewW - margin && s.y > margin && s.y < this.viewH - margin) return;
    // pointe sur le bord vers la bouée hors-champ
    const cxs = this.viewW / 2, cys = this.viewH / 2;
    const ang = Math.atan2(s.y - cys, s.x - cxs);
    const rx = Math.min(this.viewW / 2 - 40, this.viewH / 2 - 40);
    const ex = cxs + Math.cos(ang) * rx, ey = cys + Math.sin(ang) * rx;
    ctx.save();
    ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,212,59,0.95)';
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _drawMinimap(ctx) {
    const mw = Math.min(180, this.viewW * 0.24);
    const mh = mw * (BALANCE.world.height / BALANCE.world.width);
    const pad = 14;
    // Coin haut-droit : évite le bouton Manœuvrer (bas-droit) et le speedo (bas-gauche).
    const x0 = this.viewW - mw - pad, y0 = pad;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(5,25,45,0.6)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x0, y0, mw, mh, 6); ctx.fill(); ctx.stroke();
    const sx = mw / BALANCE.world.width, sy = mh / BALANCE.world.height;
    const mp = (wx, wy) => ({ x: x0 + wx * sx, y: y0 + wy * sy });
    // parcours
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    const s0 = mp(this.course.start.x, this.course.start.y);
    ctx.moveTo(s0.x, s0.y);
    for (const cp of this.checkpoints) { const p = mp(cp.x, cp.y); ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      if (cp.finish) continue;
      const p = mp(cp.x, cp.y);
      ctx.fillStyle = i === this.player.nextMark ? '#ffd43b' : '#ff9f43';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // bateaux
    for (const b of this.boats) {
      const p = mp(b.x, b.y);
      ctx.fillStyle = b.team.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, b.isPlayer ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
      if (b.isPlayer) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Pointer (choix de cap) ----------
  _bindPointer() {
    const canvas = this.canvas;
    const getXY = (e) => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };
    const down = (e) => {
      if (this.man !== MAN.AIMING) return;
      e.preventDefault();
      const p = getXY(e); this.previewAim(p.x, p.y); this._aiming = true;
    };
    const move = (e) => {
      if (this.man !== MAN.AIMING) return;
      // La flèche suit la souris en permanence (survol), pas seulement en glissant.
      const p = getXY(e); this.previewAim(p.x, p.y);
    };
    const up = (e) => {
      if (this.man !== MAN.AIMING) return;
      e.preventDefault();
      const p = e.changedTouches ? { x: e.changedTouches[0].clientX - canvas.getBoundingClientRect().left, y: e.changedTouches[0].clientY - canvas.getBoundingClientRect().top } : getXY(e);
      this.confirmAim(p.x, p.y); this._aiming = false;
    };
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up, { passive: false });
    this._pointerCleanup = () => {
      canvas.removeEventListener('mousedown', down);
      canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      canvas.removeEventListener('touchstart', down);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', up);
    };
  }

  // ---------- HUD ----------
  _emitHud() {
    const wd = this.course.wind.dir;
    this._emit('onHud', {
      speedKnots: this.player.speedKnots(),
      rank: this.player.rank,
      total: this.boats.length,
      nextMark: Math.min(this.player.nextMark + 1, this.checkpoints.length),
      totalMarks: this.checkpoints.length,
      raceClock: this.raceClock,
      cooldownFrac: this.cooldown / BALANCE.maneuver.cooldown,
      canManeuver: this.canManeuver(),
      windDir: wd,
      foiling: this.player.foiling,
      boostActive: this.player.boostTimer > 0,
    });
  }

  _emit(name, ...args) {
    const f = this.callbacks[name];
    if (f) f(...args);
  }
}
