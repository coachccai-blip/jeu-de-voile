/**
 * hud.js — RaceView : construit le HUD de course (télémétrie SailGP-like),
 * le bouton Manœuvrer + cooldown circulaire, la séquence de départ, les toasts
 * de feedback, et branche l'ensemble sur un RaceEngine via ses callbacks.
 */
import { audio } from '../audio/audio.js';
import { t } from '../i18n/strings.js';
import { QCM } from './qcm.js';
import { BALANCE } from '../config/balance.js';

export class RaceView {
  constructor(root, engine, { onQuit, onFinish, tutorial } = {}) {
    this.root = root;
    this.engine = engine;
    this.onQuit = onQuit;
    this.onFinishCb = onFinish;
    this.tutorial = tutorial;
    this._build();
    this._wire();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'race-view';
    this.el.innerHTML = `
      <div class="hud">
        <div class="hud-top">
          <div class="hud-tile hud-rank"><span class="lbl">${t('hudPosition')}</span><span class="val rank">1</span><span class="sub">/5</span></div>
          <div class="hud-tile hud-timer"><span class="lbl">Temps</span><span class="val clock">0:00</span></div>
          <div class="hud-tile hud-buoy"><span class="lbl">${t('hudNextBuoy')}</span><span class="val buoy">1</span><span class="sub marks">/1</span></div>
          <button class="hud-pause" title="${t('pause')}">II</button>
        </div>
        <div class="hud-speedo">
          <div class="speed-val"><span class="knots">0</span><span class="unit">${t('hudSpeed')}</span></div>
          <div class="speed-bar"><div class="speed-fill"></div></div>
          <div class="wind-ind" title="${t('hudWind')}"><span class="wind-arrow">➤</span><span class="wind-lbl">${t('hudWind')}</span></div>
        </div>
      </div>

      <div class="foil-flag hidden">${t('fbFoiling')}</div>
      <div class="aim-banner hidden">${t('hudManeuverHint')} — ${t('hudManeuverHint')}</div>

      <button class="maneuver-btn" aria-label="${t('hudManeuver')}">
        <svg class="cooldown-ring" viewBox="0 0 100 100">
          <circle class="cd-track" cx="50" cy="50" r="46"></circle>
          <circle class="cd-fill" cx="50" cy="50" r="46"></circle>
        </svg>
        <span class="mnv-label">${t('hudManeuver')}</span>
      </button>

      <div class="countdown hidden"><span class="count-num"></span></div>
      <div class="feedback-layer"></div>

      <div class="pause-overlay hidden">
        <div class="pause-card">
          <h2>${t('pause')}</h2>
          <button class="btn btn-primary resume-btn">${t('resume')}</button>
          <button class="btn btn-ghost quit-btn">${t('quitRace')}</button>
        </div>
      </div>
    `;
    this.root.appendChild(this.el);

    this.qcm = new QCM(this.el, (i) => this.engine.submitAnswer(i));

    this.$ = (s) => this.el.querySelector(s);
    this.rankEl = this.$('.rank');
    this.clockEl = this.$('.clock');
    this.buoyEl = this.$('.buoy');
    this.marksEl = this.$('.marks');
    this.knotsEl = this.$('.knots');
    this.speedFill = this.$('.speed-fill');
    this.windArrow = this.$('.wind-arrow');
    this.mnvBtn = this.$('.maneuver-btn');
    this.cdFill = this.$('.cd-fill');
    this.mnvLabel = this.$('.mnv-label');
    this.countEl = this.$('.countdown');
    this.countNum = this.$('.count-num');
    this.aimBanner = this.$('.aim-banner');
    this.foilFlag = this.$('.foil-flag');
    this.fbLayer = this.$('.feedback-layer');
    this.pauseOverlay = this.$('.pause-overlay');

    this._cdCircum = 2 * Math.PI * 46;
    this.cdFill.style.strokeDasharray = this._cdCircum;

    // Interactions
    this.mnvBtn.addEventListener('click', () => {
      audio.sfx('uiClick');
      this.engine.pressManeuver();
    });
    window.addEventListener('keydown', this._keyHandler = (e) => {
      if (e.code === 'Space') { e.preventDefault(); this.engine.pressManeuver(); }
      if (e.code === 'Escape') this._togglePause();
    });
    this.$('.hud-pause').addEventListener('click', () => this._togglePause());
    this.$('.resume-btn').addEventListener('click', () => this._togglePause());
    this.$('.quit-btn').addEventListener('click', () => { this.destroy(); this.onQuit && this.onQuit(); });

    window.addEventListener('resize', this._resize = () => this.engine.resize());
  }

  _togglePause() {
    const paused = !this.engine.paused;
    this.engine.setPaused(paused);
    this.pauseOverlay.classList.toggle('hidden', !paused);
    // En pause : coupe la musique (et l'ambiance vent) ; reprend au resume.
    if (paused) { audio.stopMusic(); audio.stopWind(); }
    else { audio.playMusic('race'); audio.startWind(); }
    audio.sfx('uiClick');
  }

  _wire() {
    const cb = this.engine.callbacks;
    cb.onHud = (d) => this._updateHud(d);
    cb.onQuestionShow = (q) => { this.qcm.show(q); if (this.tutorial) this.tutorial.notify('question'); };
    cb.onQuestionTick = (rem, frac) => this.qcm.tick(rem, frac);
    cb.onQuestionResult = (correct, idx, correctIdx, timedOut) => this.qcm.result(correct, idx, correctIdx);
    cb.onAimStart = () => { this.aimBanner.textContent = '👉 ' + t('hudManeuverHint'); this.aimBanner.classList.remove('hidden'); };
    cb.onManeuverEnd = () => { this.aimBanner.classList.add('hidden'); if (this.tutorial) this.tutorial.notify('maneuver'); };
    cb.onCountdown = (txt) => this._showCount(txt);
    cb.onFeedback = (kind) => this._feedback(kind);
    cb.onFinish = (results, won) => { this.onFinishCb && this.onFinishCb(results, won); };
  }

  _updateHud(d) {
    this.rankEl.textContent = d.rank;
    this.$('.hud-rank .sub').textContent = '/' + d.total;
    this.clockEl.textContent = this._fmt(d.raceClock);
    this.buoyEl.textContent = d.nextMark;
    this.marksEl.textContent = '/' + d.totalMarks;
    this.knotsEl.textContent = Math.round(d.speedKnots);
    const frac = Math.min(1, d.speedKnots / 52);
    this.speedFill.style.width = (frac * 100) + '%';
    this.speedFill.classList.toggle('boost', d.boostActive);
    // cooldown ring
    const offset = this._cdCircum * (1 - d.cooldownFrac);
    this.cdFill.style.strokeDashoffset = offset;
    this.mnvBtn.classList.toggle('ready', d.canManeuver);
    this.mnvBtn.classList.toggle('cooling', d.cooldownFrac > 0);
    this.mnvLabel.textContent = d.cooldownFrac > 0 ? (Math.ceil(d.cooldownFrac * BALANCE.maneuver.cooldown)) : t('hudManeuver');
    // vent (flèche pointant vers la direction du vent, relative — ici absolue)
    this.windArrow.style.transform = `rotate(${d.windDir}rad)`;
    this.foilFlag.classList.toggle('hidden', !d.foiling);
  }

  _showCount(txt) {
    this.countNum.textContent = txt;
    this.countEl.classList.remove('hidden', 'go');
    if (txt === 'GO') this.countEl.classList.add('go');
    this.countNum.classList.remove('pop'); void this.countNum.offsetWidth; this.countNum.classList.add('pop');
    if (txt === 'GO') setTimeout(() => this.countEl.classList.add('hidden'), 800);
  }

  _feedback(kind) {
    const map = {
      boost: { txt: t('qcmBoost') + ' !', cls: 'fb-boost' },
      buoy: { txt: t('fbBuoy'), cls: 'fb-buoy' },
      splash: { txt: t('fbSplash'), cls: 'fb-splash' },
      foiling: { txt: t('fbFoiling'), cls: 'fb-foil' },
      finish: { txt: '🏁 ' + t('podiumTitle'), cls: 'fb-finish' },
    };
    const m = map[kind]; if (!m) return;
    const el = document.createElement('div');
    el.className = 'fb-toast ' + m.cls;
    el.textContent = m.txt;
    this.fbLayer.appendChild(el);
    if (this.tutorial && kind === 'buoy') this.tutorial.notify('buoy');
    setTimeout(() => el.classList.add('out'), 700);
    setTimeout(() => el.remove(), 1200);
  }

  _fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  destroy() {
    window.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('resize', this._resize);
    this.qcm.destroy();
    this.el.remove();
  }
}
