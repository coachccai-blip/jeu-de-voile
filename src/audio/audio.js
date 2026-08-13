/**
 * audio.js — Moteur audio 100% procédural (Web Audio API).
 * - 2 musiques (menu / course) via petits séquenceurs.
 * - Tous les bruitages du brief, générés (oscillateurs + bruit).
 * - Volumes séparés musique / effets, persistés par le module save.
 * Aucun fichier binaire requis → libre de droits & hors ligne.
 */
import { MUSIC_MANIFEST } from './manifest.js';
import { getSettings, setSetting } from '../save/save.js';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.windGain = null;
    this.started = false;
    this.currentTrack = null;
    this._seqTimer = null;
    this._windNode = null;
    const s = getSettings();
    this.musicVolume = s.musicVolume;
    this.sfxVolume = s.sfxVolume;
  }

  /** Doit être appelé sur une interaction utilisateur (politique autoplay). */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    this.windGain.connect(this.master);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setMusicVolume(v) {
    this.musicVolume = v; setSetting('musicVolume', v);
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
  setSfxVolume(v) {
    this.sfxVolume = v; setSetting('sfxVolume', v);
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // ---------- utilitaires synthèse ----------
  _now() { return this.ctx.currentTime; }

  _noiseBuffer(seconds = 1) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _tone(freq, t0, dur, type = 'sine', gain = 0.3, dest = null) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return { o, g };
  }

  _sweep(f0, f1, t0, dur, type = 'sawtooth', gain = 0.3, dest = null) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noiseBurst(t0, dur, gain = 0.4, filterType = 'lowpass', freq = 1200, dest = null) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.05);
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // ---------- BRUITAGES ----------
  sfx(name) {
    if (!this.ctx) return;
    this.resume();
    const t = this._now();
    switch (name) {
      case 'uiClick':      this._tone(520, t, 0.08, 'triangle', 0.25); break;
      case 'uiHover':      this._tone(680, t, 0.05, 'sine', 0.10); break;
      case 'qcmOpen':      this._sweep(300, 700, t, 0.18, 'sine', 0.22); break;
      case 'correct':      this._tone(660, t, 0.12, 'sine', 0.28); this._tone(880, t + 0.09, 0.16, 'sine', 0.28); break;
      case 'wrong':        this._tone(200, t, 0.22, 'sawtooth', 0.25); this._tone(150, t + 0.04, 0.25, 'square', 0.16); break;
      case 'tick':         this._tone(1200, t, 0.03, 'square', 0.08); break;
      case 'boost':        this._sweep(220, 900, t, 0.5, 'sawtooth', 0.28); this._noiseBurst(t, 0.5, 0.18, 'highpass', 800); break;
      case 'buoy':         this._tone(880, t, 0.1, 'sine', 0.22); this._tone(1320, t + 0.08, 0.14, 'sine', 0.2); break;
      case 'splash':       this._noiseBurst(t, 0.6, 0.5, 'lowpass', 900); this._sweep(400, 80, t, 0.5, 'sine', 0.2); break;
      case 'foilUp':       this._sweep(300, 1400, t, 0.7, 'sine', 0.2); this._noiseBurst(t, 0.7, 0.12, 'bandpass', 2500); break;
      case 'countBeep':    this._tone(440, t, 0.15, 'square', 0.3); break;
      case 'go':           this._tone(880, t, 0.4, 'square', 0.35); this._sweep(200, 600, t, 0.6, 'sawtooth', 0.25); this._noiseBurst(t, 0.5, 0.2, 'lowpass', 600); break;
      case 'finish':       this._tone(660, t, 0.2, 'square', 0.3); this._tone(990, t + 0.15, 0.3, 'square', 0.3); this._noiseBurst(t, 0.8, 0.15, 'highpass', 1000); break;
      case 'victory':      this._fanfare(t, true); break;
      case 'defeat':       this._fanfare(t, false); break;
      case 'unlock':       this._tone(523, t, 0.12, 'sine', 0.25); this._tone(659, t + 0.1, 0.12, 'sine', 0.25); this._tone(784, t + 0.2, 0.2, 'sine', 0.25); break;
      default: break;
    }
  }

  _fanfare(t, win) {
    const notes = win ? [523, 659, 784, 1047, 1047] : [523, 466, 392, 349];
    const times = win ? [0, 0.12, 0.24, 0.36, 0.5] : [0, 0.2, 0.4, 0.65];
    notes.forEach((n, i) => {
      this._tone(n, t + times[i], win ? 0.35 : 0.4, 'square', 0.22);
      this._tone(n * 1.5, t + times[i], 0.2, 'triangle', 0.10);
    });
    if (win) this._noiseBurst(t + 0.5, 0.6, 0.12, 'highpass', 1500); // confettis/écume
  }

  // ---------- AMBIANCE VENT/EAU (boucle continue en course) ----------
  startWind() {
    if (!this.ctx || this._windNode) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
    src.connect(f); f.connect(this.windGain);
    src.start();
    this._windNode = { src, f };
    this.windGain.gain.setTargetAtTime(0.05, this._now(), 0.5);
  }
  /** Intensité vent liée à la vitesse du bateau [0..1]. */
  setWindIntensity(x) {
    if (!this._windNode) return;
    const g = 0.03 + x * 0.16;
    this.windGain.gain.setTargetAtTime(g, this._now(), 0.15);
    this._windNode.f.frequency.setTargetAtTime(400 + x * 900, this._now(), 0.15);
  }
  stopWind() {
    if (!this._windNode) return;
    this.windGain.gain.setTargetAtTime(0, this._now(), 0.3);
    const node = this._windNode; this._windNode = null;
    setTimeout(() => { try { node.src.stop(); } catch (e) {} }, 500);
  }

  // ---------- MUSIQUE (séquenceur simple) ----------
  playMusic(id) {
    if (!this.ctx) return;
    if (this.currentTrack === id) return;
    this.stopMusic();
    const track = MUSIC_MANIFEST.find(m => m.id === id);
    if (!track) return;
    this.currentTrack = id;
    this._startSequencer(track);
  }

  stopMusic() {
    if (this._seqTimer) { clearInterval(this._seqTimer); this._seqTimer = null; }
    this.currentTrack = null;
  }

  _startSequencer(track) {
    const beat = 60 / track.bpm;
    let step = 0;
    const semis = s => track.root * Math.pow(2, s / 12);
    const playStep = () => {
      if (!this.ctx) return;
      const t = this._now() + 0.02;
      const chord = track.chords[Math.floor(step / 4) % track.chords.length];
      const isRace = track.id === 'race';
      // Basse
      const bassNote = semis(chord[0] - 12);
      this._tone(bassNote, t, beat * 0.9, isRace ? 'sawtooth' : 'sine', isRace ? 0.12 : 0.09, this.musicGain);
      // Nappe/arpège
      if (isRace) {
        const arp = chord[step % chord.length];
        this._tone(semis(arp), t, beat * 0.5, 'square', 0.06, this.musicGain);
        // Percussion (hats)
        this._noiseBurst(t, 0.04, 0.05, 'highpass', 6000, this.musicGain);
        if (step % 4 === 0) this._noiseBurst(t, 0.12, 0.10, 'lowpass', 200, this.musicGain); // kick
      } else {
        if (step % 2 === 0) {
          chord.forEach((c, i) => this._tone(semis(c), t, beat * 1.8, 'sine', 0.045 - i * 0.006, this.musicGain));
        }
        const mel = chord[(step * 3) % chord.length] + 12;
        this._tone(semis(mel), t + beat * 0.5, beat * 0.6, 'triangle', 0.05, this.musicGain);
      }
      step++;
    };
    playStep();
    this._seqTimer = setInterval(playStep, beat * 1000);
  }
}

export const audio = new AudioEngine();
