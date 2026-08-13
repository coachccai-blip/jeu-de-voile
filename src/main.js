/**
 * main.js — Point d'entrée. Machine à états des écrans + lancement des courses.
 */
import { audio } from './audio/audio.js';
import { RaceEngine } from './game/engine.js';
import { RaceView } from './ui/hud.js';
import {
  renderMenu, renderMap, renderPreCourse, renderPodium,
  renderSettings, renderCredits, createTutorial,
} from './ui/screens.js';
import { COURSES } from './data/courses.js';
import { difficultyIndexFromSlider } from './config/balance.js';
import { recordResult, getCourseProgress, isTutorialSeen, setTutorialSeen } from './save/save.js';
import { registerSW } from './pwa.js';

registerSW();

const app = document.getElementById('app');
const root = document.createElement('div');
root.id = 'screen-root';
app.appendChild(root);

let current = { engine: null, view: null, tutorial: null };
let audioReady = false;

function ensureAudio() {
  if (audioReady) return;
  audio.init();
  audio.resume();
  audioReady = true;
}
// L'audio ne peut démarrer qu'après une interaction (politique navigateur).
window.addEventListener('pointerdown', ensureAudio, { once: true });
window.addEventListener('keydown', ensureAudio, { once: true });

function cleanupRace() {
  if (current.view) { current.view.destroy(); current.view = null; }
  if (current.engine) { current.engine.stop(); current.engine = null; }
  if (current.tutorial) { current.tutorial.destroy && current.tutorial.destroy(); current.tutorial = null; }
}

function go(screen, params = {}) {
  ensureAudio();
  cleanupRace();
  const ctx = { root, go };
  switch (screen) {
    case 'menu': renderMenu(ctx); break;
    case 'campaign':
      // Tutoriel proposé avant la 1ère course si jamais vu.
      if (!isTutorialSeen()) { go('tutorial', { fromCampaign: true }); return; }
      renderMap(ctx);
      break;
    case 'precourse': renderPreCourse(ctx, params); break;
    case 'race': startRace(params); break;
    case 'tutorial': startTutorial(params); break;
    case 'podium': renderPodium(ctx, params); break;
    case 'settings': renderSettings(ctx); break;
    case 'credits': renderCredits(ctx); break;
    default: renderMenu(ctx);
  }
}

function makeCanvas() {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'race-stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'race-canvas';
  wrap.appendChild(canvas);
  root.appendChild(wrap);
  return { wrap, canvas };
}

function startRace({ courseId, slider }) {
  const course = COURSES.find(c => c.id === courseId);
  const { wrap, canvas } = makeCanvas();
  const engine = new RaceEngine(canvas, course, slider);
  const view = new RaceView(wrap, engine, {
    onQuit: () => go('campaign'),
    onRestart: () => go('race', { courseId, slider }),
    onFinish: (results, won) => finishRace(course, slider, results, won, engine),
  });
  current.engine = engine; current.view = view;
  window.__regatta.engine = engine;
  requestAnimationFrame(() => { engine.resize(); engine.start(); });
}

function finishRace(course, slider, results, won, engine) {
  const timeMs = engine.player.finishTime * 1000;
  const wasWon = getCourseProgress(course.id).won;
  const diffIndex = difficultyIndexFromSlider(slider);
  const recordInfo = recordResult(course.id, won, timeMs, diffIndex);
  // Débloquer la course suivante si victoire
  if (won && !wasWon) {
    setTimeout(() => audio.sfx('unlock'), 400);
  }
  const stats = { ...engine.stats };
  cleanupRace();
  go('podium', { results, won, courseId: course.id, slider, diffIndex, recordInfo, stats });
}

function startTutorial({ fromCampaign } = {}) {
  const course = COURSES[0];
  const { wrap, canvas } = makeCanvas();
  const engine = new RaceEngine(canvas, course, 0.0, { tutorial: true });
  const finishTut = () => {
    setTutorialSeen(true);
    cleanupRace();
    go(fromCampaign ? 'campaign' : 'menu');
  };
  const tutorial = createTutorial(wrap, finishTut);
  const view = new RaceView(wrap, engine, {
    onQuit: finishTut,
    onFinish: () => {}, // en tutoriel, pas de podium : on termine via le panneau
    tutorial,
  });
  current.engine = engine; current.view = view; current.tutorial = tutorial;
  requestAnimationFrame(() => { engine.resize(); engine.start(); });
}

// Démarrage
window.__regatta = { go }; // hook debug
go('menu');
