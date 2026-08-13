/**
 * save.js — Persistance localStorage avec versioning de schéma + migration simple.
 */
import { BALANCE } from '../config/balance.js';

const KEY = 'regatta-quiz-save';
const SCHEMA_VERSION = 2;

function defaultSave() {
  return {
    version: SCHEMA_VERSION,
    tutorialSeen: false,
    settings: {
      musicVolume: BALANCE.audio.musicVolume,
      sfxVolume: BALANCE.audio.sfxVolume,
      lastDifficulty: BALANCE.difficulty.defaultIndex / (BALANCE.difficulty.levels.length - 1),
    },
    // progression par id de course
    courses: {}, // { [courseId]: { won:bool, bestTimes:[ms,...] } }
  };
}

function migrate(data) {
  if (!data || typeof data !== 'object') return defaultSave();
  let d = data;
  // v1 -> v2 : ajout lastDifficulty en float continu
  if (d.version === 1) {
    d.settings = d.settings || {};
    if (typeof d.settings.lastDifficulty !== 'number') {
      d.settings.lastDifficulty = defaultSave().settings.lastDifficulty;
    }
    d.version = 2;
  }
  // Complète les champs manquants (robustesse)
  const base = defaultSave();
  d = { ...base, ...d };
  d.settings = { ...base.settings, ...(d.settings || {}) };
  d.courses = d.courses || {};
  d.version = SCHEMA_VERSION;
  return d;
}

let cache = null;

export function loadSave() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? migrate(JSON.parse(raw)) : defaultSave();
  } catch (e) {
    cache = defaultSave();
  }
  return cache;
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) { /* quota/private mode : on ignore */ }
}

export function resetSave() {
  cache = defaultSave();
  persist();
  return cache;
}

export function getSettings() { return loadSave().settings; }
export function setSetting(key, value) {
  const s = loadSave();
  s.settings[key] = value;
  persist();
}

export function getCourseProgress(courseId) {
  const s = loadSave();
  return s.courses[courseId] || { won: false, bestTimes: [] };
}

/** Enregistre un résultat de course. Renvoie {isRecord, rank}. */
export function recordResult(courseId, won, timeMs) {
  const s = loadSave();
  const c = s.courses[courseId] || { won: false, bestTimes: [] };
  if (won) c.won = true;
  let isRecord = false;
  if (typeof timeMs === 'number' && timeMs > 0) {
    const before = c.bestTimes.slice();
    c.bestTimes.push(Math.round(timeMs));
    c.bestTimes.sort((a, b) => a - b);
    c.bestTimes = c.bestTimes.slice(0, 5);
    isRecord = c.bestTimes[0] === Math.round(timeMs) && (before.length === 0 || Math.round(timeMs) < before[0]);
  }
  s.courses[courseId] = c;
  persist();
  return { isRecord, bestTimes: c.bestTimes };
}

export function setTutorialSeen(v = true) {
  loadSave().tutorialSeen = v;
  persist();
}
export function isTutorialSeen() { return loadSave().tutorialSeen; }
