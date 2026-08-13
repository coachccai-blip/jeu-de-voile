/**
 * questionBank.js — Banque de questions DÉCOUPLÉE du moteur de jeu.
 *
 * Interface :  getNextQuestion(difficulty) -> { prompt, choices[4], correctIndex, timeLimit }
 *
 * v1 : générateur procédural d'additions / soustractions d'entiers.
 * Extensible : voir mdLoader.js pour importer des banques externes (.md) plus tard.
 * Une course peut fournir sa propre instance de banque (ex. maths, géo, anglais…).
 */

import { getChapter } from './leyton.js';

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Construit un QCM à partir de la bonne réponse + distracteurs plausibles. */
function buildChoices(correct) {
  const set = new Set([correct]);
  const candidates = [
    correct + 1, correct - 1, correct + 10, correct - 10,
    correct + 2, correct - 2, correct + 9, correct + 11,
  ];
  shuffle(candidates);
  for (const c of candidates) {
    if (set.size >= 4) break;
    if (c >= 0 && !set.has(c)) set.add(c);
  }
  // Filet de sécurité si peu de candidats valides
  let pad = correct + 3;
  while (set.size < 4) { if (pad >= 0 && !set.has(pad)) set.add(pad); pad++; }
  const choices = shuffle([...set]).slice(0, 4);
  if (!choices.includes(correct)) choices[randInt(0, 3)] = correct;
  return choices;
}

function hasCarry(a, b, op) {
  if (op === '+') return (a % 10) + (b % 10) >= 10;
  return (a % 10) < (b % 10); // emprunt en soustraction
}

export class ProceduralMathBank {
  constructor() { this.id = 'math-proc'; this.label = 'Calcul mental'; }

  /**
   * @param {object} difficulty  résultat de difficultyFromSlider()
   */
  getNextQuestion(difficulty) {
    const max = Math.max(5, difficulty.maxOperand);
    const wantCarry = difficulty.carry;
    const op = Math.random() < 0.5 ? '+' : '-';
    let a, b, tries = 0;
    do {
      a = randInt(1, max);
      b = randInt(1, max);
      if (op === '-' && b > a) [a, b] = [b, a]; // pas de résultat négatif
      tries++;
    } while (tries < 12 && wantCarry && !hasCarry(a, b, op));

    const correct = op === '+' ? a + b : a - b;
    const choices = buildChoices(correct);
    return {
      prompt: `${a} ${op} ${b}`,
      choices,
      correctIndex: choices.indexOf(correct),
      timeLimit: difficulty.timeLimit,
      meta: { a, b, op },
    };
  }
}

// Banque par défaut (calcul mental) — utilisée par le TUTORIEL uniquement.
export const defaultBank = new ProceduralMathBank();

/**
 * VraiFauxBank — banque « vrai ou faux » cantonnée à UN produit Leyton (un chapitre).
 * Chaque question est une affirmation (vraie ou fausse) ; le joueur répond Vrai/Faux.
 * Interface identique : getNextQuestion() → { type:'vraifaux', prompt, choices, correctIndex, timeLimit }
 */
export class VraiFauxBank {
  constructor(chapter, timeLimit) {
    this.id = 'vf-' + chapter.id;
    this.label = chapter.short;
    this.chapter = chapter;
    this.timeLimit = timeLimit || VF_TIME_LIMIT;
    this._reshuffle();
  }

  _reshuffle() {
    const pool = [];
    for (const text of this.chapter.vrai) pool.push({ text, isTrue: true });
    for (const text of this.chapter.faux) pool.push({ text, isTrue: false });
    shuffle(pool);
    this.pool = pool;
    this.cursor = 0;
  }

  getNextQuestion() {
    if (!this.pool.length) return null;
    if (this.cursor >= this.pool.length) this._reshuffle();
    const item = this.pool[this.cursor++];
    return {
      type: 'vraifaux',
      prompt: item.text,
      choices: ['Vrai', 'Faux'],
      correctIndex: item.isTrue ? 0 : 1,
      timeLimit: this.timeLimit,
    };
  }
}

// Temps RÉEL max (s) pour répondre à une affirmation vrai/faux.
export const VF_TIME_LIMIT = 8;

// Une banque vrai/faux par chapitre Leyton (construites à la demande, mises en cache).
const _vfCache = {};
export function getVraiFauxBank(chapterId) {
  if (_vfCache[chapterId]) return _vfCache[chapterId];
  const chapter = getChapter(chapterId);
  if (!chapter) return defaultBank;
  const bank = new VraiFauxBank(chapter);
  _vfCache[chapterId] = bank;
  return bank;
}

/**
 * Registre de banques. 'math-proc' = tutoriel (calcul). Sinon on cherche un
 * chapitre Leyton du même id → banque vrai/faux cantonnée à ce produit.
 */
export function getBank(key) {
  if (!key || key === 'math-proc') return defaultBank;
  if (getChapter(key)) return getVraiFauxBank(key);
  return defaultBank;
}
