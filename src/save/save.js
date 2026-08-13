/**
 * save.js — Persistance localStorage avec versioning de schéma + migration simple.
 */
import { BALANCE } from '../config/balance.js';

const KEY = 'regatta-quiz-save';
const SCHEMA_VERSION = 3;
const NB_DIFF = BALANCE.difficulty.levels.length; // 5

function emptyTrophies() { return new Array(NB_DIFF).fill(false); }

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
    // { [courseId]: { won:bool, bestTimes:[ms,...], trophies:[bool×5] } }
    courses: {},
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
  // v2 -> v3 : trophées par difficulté (5 par course)
  if (d.version === 2) {
    for (const id in (d.courses || {})) {
      const c = d.courses[id];
      if (!Array.isArray(c.trophies)) c.trophies = emptyTrophies();
    }
    d.version = 3;
  }
  // Complète les champs manquants (robustesse)
  const base = defaultSave();
  d = { ...base, ...d };
  d.settings = { ...base.settings, ...(d.settings || {}) };
  d.courses = d.courses || {};
  for (const id in d.courses) {
    const c = d.courses[id];
    if (!Array.isArray(c.trophies)) c.trophies = emptyTrophies();
    if (c.trophies.length < NB_DIFF) while (c.trophies.length < NB_DIFF) c.trophies.push(false);
  }
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
  const c = s.courses[courseId];
  if (!c) return { won: false, bestTimes: [], trophies: emptyTrophies() };
  if (!Array.isArray(c.trophies)) c.trophies = emptyTrophies();
  return c;
}

/** Nombre de trophées gagnés (0..5) pour une course. */
export function trophyCount(courseId) {
  return getCourseProgress(courseId).trophies.filter(Boolean).length;
}

/**
 * Enregistre un résultat de course.
 * @param diffIndex index de difficulté 0..4 (le trophée correspondant est gagné si victoire)
 * Renvoie { isRecord, bestTimes, trophies, newTrophy }.
 */
export function recordResult(courseId, won, timeMs, diffIndex) {
  const s = loadSave();
  const c = s.courses[courseId] || { won: false, bestTimes: [], trophies: emptyTrophies() };
  if (!Array.isArray(c.trophies)) c.trophies = emptyTrophies();
  let newTrophy = false;
  if (won) {
    c.won = true;
    if (typeof diffIndex === 'number' && diffIndex >= 0 && diffIndex < NB_DIFF && !c.trophies[diffIndex]) {
      c.trophies[diffIndex] = true;
      newTrophy = true;
    }
  }
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
  return { isRecord, bestTimes: c.bestTimes, trophies: c.trophies.slice(), newTrophy };
}

export function setTutorialSeen(v = true) {
  loadSave().tutorialSeen = v;
  persist();
}
export function isTutorialSeen() { return loadSave().tutorialSeen; }
