/**
 * screens.js — Écrans HTML/CSS : menu, carte du monde, pré-course, podium,
 * réglages, crédits, et contrôleur de tutoriel.
 * Chaque fonction rend dans `ctx.root` et navigue via `ctx.go(name, params)`.
 */
import { t } from '../i18n/strings.js';
import { audio } from '../audio/audio.js';
import { COURSES, TEAMS, courseIndex, geoToMap } from '../data/courses.js';
import { getChapter } from '../data/leyton.js';
import { BALANCE, difficultyFromSlider, difficultyIndexFromSlider } from '../config/balance.js';
import { drawWorldMap } from './worldmap.js';
import { canInstall, isInstalled, isIOS, promptInstall, onPwaChange } from '../pwa.js';

/** Rangée de 5 trophées (un par difficulté). `current`/`earnedNow` = index à mettre en avant. */
function trophiesHTML(trophies, { current = -1, earnedNow = -1 } = {}) {
  return `<span class="trophies">` + BALANCE.difficulty.levels.map((lv, i) => {
    const got = trophies && trophies[i];
    const cls = ['trophy', got ? 'got' : 'empty', i === current ? 'current' : '', i === earnedNow ? 'earned-now' : ''].join(' ').trim();
    return `<span class="${cls}" title="${lv.label}">${got ? '🏆' : '○'}</span>`;
  }).join('') + `</span>`;
}
import {
  getCourseProgress, getSettings, setSetting, resetSave, isTutorialSeen,
} from '../save/save.js';

function clear(root) { root.innerHTML = ''; }
function fmtTime(ms) {
  if (!ms || ms === Infinity) return t('mapNoTime');
  const s = ms / 1000, m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
}
function btnSfx(el) {
  el.addEventListener('mouseenter', () => audio.sfx('uiHover'));
  el.addEventListener('click', () => audio.sfx('uiClick'));
}

/** Un site est débloqué si c'est le 1er, ou si le précédent est gagné. */
function isUnlocked(idx) {
  if (idx === 0) return true;
  return getCourseProgress(COURSES[idx - 1].id).won;
}

// ─────────────────────────────── MENU ───────────────────────────────
export function renderMenu(ctx) {
  clear(ctx.root);
  audio.playMusic('menu');
  const el = document.createElement('div');
  el.className = 'screen menu-screen';
  el.innerHTML = `
    <canvas class="menu-bg"></canvas>
    <div class="menu-content">
      <h1 class="game-title">${t('gameTitle')}</h1>
      <p class="game-sub">${t('gameSubtitle')}</p>
      <nav class="menu-nav">
        <button class="btn btn-primary big" data-go="campaign">⛵ ${t('menuCampaign')}</button>
        <button class="btn" data-go="tutorial">🎓 ${t('menuTutorial')}</button>
        <button class="btn" data-go="settings">⚙️ ${t('menuSettings')}</button>
        <button class="btn install-btn">${t('menuInstall')}</button>
        <button class="btn btn-ghost" data-go="credits">${t('menuCredits')}</button>
      </nav>
      <p class="key-hint">${t('keyHint')}</p>
    </div>
    <div class="modal-overlay hidden install-modal">
      <div class="modal-card">
        <h2>${t('installTitle')}</h2>
        <pre class="install-text"></pre>
        <div class="modal-actions"><button class="btn btn-ghost install-close">${t('installClose')}</button></div>
      </div>
    </div>
  `;
  ctx.root.appendChild(el);
  startMenuBg(el.querySelector('.menu-bg'));
  el.querySelectorAll('button[data-go]').forEach(b => {
    btnSfx(b);
    b.addEventListener('click', () => ctx.go(b.dataset.go));
  });

  // Bouton « Installer le jeu » (PWA)
  const installBtn = el.querySelector('.install-btn');
  const modal = el.querySelector('.install-modal');
  const installText = el.querySelector('.install-text');
  let off = null;
  const refreshInstall = () => {
    if (!installBtn.isConnected) { if (off) off(); return; } // menu remplacé : on se désabonne
    if (isInstalled()) { installBtn.textContent = t('installAlready'); installBtn.disabled = true; installBtn.classList.add('btn-ghost'); }
    else { installBtn.textContent = t('menuInstall'); installBtn.disabled = false; }
  };
  refreshInstall();
  off = onPwaChange(refreshInstall);
  btnSfx(installBtn);
  installBtn.addEventListener('click', async () => {
    if (isInstalled()) return;
    if (canInstall()) {
      const outcome = await promptInstall();
      if (outcome !== 'accepted') { installText.textContent = t('installGeneric'); modal.classList.remove('hidden'); }
    } else {
      installText.textContent = isIOS() ? t('installIOS') : t('installGeneric');
      modal.classList.remove('hidden');
    }
  });
  el.querySelector('.install-close').addEventListener('click', () => { audio.sfx('uiClick'); modal.classList.add('hidden'); });
}

function startMenuBg(canvas) {
  const ctx = canvas.getContext('2d');
  let raf, t0 = performance.now();
  const boats = Array.from({ length: 5 }, (_, i) => ({
    x: Math.random(), y: 0.3 + Math.random() * 0.5, spd: 0.02 + Math.random() * 0.03, c: TEAMS[i].color,
  }));
  function resize() {
    canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  function frame(now) {
    const dt = (now - t0) / 1000; t0 = now;
    const w = canvas.width, h = canvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#072c4a'); g.addColorStop(1, '#0b4a74');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(180,225,255,0.08)'; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const y = (i / 8) * h + Math.sin(now / 1000 + i) * 6;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.01 + now / 800 + i) * 8);
      ctx.stroke();
    }
    for (const b of boats) {
      b.x += b.spd * dt; if (b.x > 1.1) b.x = -0.1;
      const px = b.x * w, py = b.y * h;
      ctx.save(); ctx.translate(px, py);
      ctx.fillStyle = 'rgba(220,245,255,0.25)';
      ctx.beginPath(); ctx.ellipse(-14, 4, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, 5); ctx.lineTo(-10, -5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(-8, -18); ctx.lineTo(-10, -2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  canvas._stop = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}

// ─────────────────────────── CARTE DU MONDE ───────────────────────────
export function renderMap(ctx) {
  clear(ctx.root);
  audio.playMusic('menu');
  const el = document.createElement('div');
  el.className = 'screen map-screen';
  el.innerHTML = `
    <header class="screen-head">
      <button class="btn btn-ghost" data-back>${t('mapBack')}</button>
      <h2>${t('mapTitle')}</h2><div></div>
    </header>
    <div class="world-map">
      <canvas class="world-canvas"></canvas>
      <div class="sites"></div>
    </div>
  `;
  ctx.root.appendChild(el);
  startWorldCanvas(el.querySelector('.world-canvas'));
  const sites = el.querySelector('.sites');
  const positions = computeSitePositions();
  COURSES.forEach((c, idx) => {
    const unlocked = isUnlocked(idx);
    const prog = getCourseProgress(c.id);
    const pos = positions[idx];
    const node = document.createElement('button');
    node.className = `site ${unlocked ? 'unlocked' : 'locked'} ${prog.won ? 'won' : ''}`;
    node.style.left = (pos.x * 100) + '%';
    node.style.top = (pos.y * 100) + '%';
    const tcount = prog.trophies.filter(Boolean).length;
    const chapter = getChapter(c.chapter);
    const product = chapter ? chapter.short : c.name;
    node.innerHTML = `
      <span class="site-dot">${tcount > 0 ? `<span class="site-count">${tcount}</span>` : ''}</span>
      <span class="site-name-tag"><b class="site-num">${idx + 1}</b> ${product}</span>
      <span class="site-card">
        <strong>${chapter ? chapter.title : c.name}</strong>
        <em>${c.name} · ${c.country}</em>
        <span class="site-status">${prog.won ? '🏆 ' + t('mapWon') : unlocked ? t('mapAvailable') : '🔒 ' + t('mapLocked')}</span>
        <span class="site-trophies-label">${t('mapTrophies')} ${prog.trophies.filter(Boolean).length}/5</span>
        ${trophiesHTML(prog.trophies)}
        <span class="site-best">${t('mapBestTime')} : ${fmtTime(prog.bestTimes[0])}</span>
      </span>`;
    btnSfx(node);
    node.addEventListener('click', () => {
      if (!unlocked) { audio.sfx('wrong'); node.classList.add('shake'); setTimeout(() => node.classList.remove('shake'), 400); return; }
      ctx.go('precourse', { courseId: c.id });
    });
    sites.appendChild(node);
  });
  el.querySelector('[data-back]').addEventListener('click', () => { audio.sfx('uiClick'); ctx.go('menu'); });
}

/**
 * Positions des sites = vraie géographie (projection équirectangulaire), avec un
 * léger écartement anti-chevauchement pour les villes trop proches (ex. Marseille /
 * Saint-Tropez, distantes de ~60 km, donc quasi au même pixel à l'échelle mondiale).
 */
function computeSitePositions() {
  const pos = COURSES.map(c => geoToMap(c.geo));
  const minSep = 0.045; // écart minimal (fraction de la largeur)
  for (let iter = 0; iter < 40; iter++) {
    let moved = false;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        let dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
        let d = Math.hypot(dx, dy);
        if (d < minSep) {
          if (d < 1e-6) { dx = 0.01; dy = 0; d = 0.01; }
          const push = (minSep - d) / 2;
          const ux = dx / d, uy = dy / d;
          pos[i].x -= ux * push; pos[i].y -= uy * push;
          pos[j].x += ux * push; pos[j].y += uy * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  // garde les pastilles dans le cadre
  for (const p of pos) { p.x = Math.max(0.03, Math.min(0.97, p.x)); p.y = Math.max(0.06, Math.min(0.94, p.y)); }
  return pos;
}

function startWorldCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  let raf, t0 = performance.now();
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  function frame(now) {
    const time = (now - t0) / 1000;
    drawWorldMap(ctx, canvas.clientWidth, canvas.clientHeight, time);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  canvas._stop = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}

// Emoji « héros » par produit (rend la fiche mémo plus vivante).
const CHAPTER_EMOJI = {
  'cir': '🔬', 'ipbox': '💡', 'aides': '💶', 'bpo': '🏥',
  'payroll': '👥', 'taxes-locales': '🏙️', 'taxes-nationales': '🏛️', 'energie': '⚡',
};

// Décorateur : insère des emojis PERTINENTS après certains mots-clés du texte.
// (Appliqué au texte de présentation pour l'aérer, pas aux 60 affirmations.)
const EMOJI_RULES = [
  [/\brecherche(s)?\b/i, '🔬'], [/\binnovation(s)?\b/i, '💡'], [/\bbrevet(s)?\b/i, '📄'],
  [/\bcontrôle fiscal\b/i, '🔎'], [/\bmillions? d.euros\b/i, '💶'], [/\b€\b/i, '💶'],
  [/\binternational(e|ement)?\b/i, '🌍'], [/\b1?7 pays\b/i, '🌍'],
  [/\bformation(s)?\b/i, '🎓'], [/\bavocat(s)?\b/i, '⚖️'], [/\bplateforme\b/i, '💻'],
  [/\bénergie(s)?\b/i, '⚡'], [/\bsalari(é|és|aux)\b/i, '👥'], [/\bcharges sociales\b/i, '💼'],
  [/\btaxe(s)?\b/i, '🧾'], [/\bsubvention(s)?\b/i, '💶'], [/\bclient(s|e|es)?\b/i, '🤝'],
  [/\béquipe(s)?\b/i, '👥'], [/\bcroissance\b/i, '📈'], [/\bremboursement\b/i, '💰'],
  [/\bsécuris(e|é|ation)\w*\b/i, '🔒'], [/\bméthodologie\b/i, '🧭'], [/\bdéclaration(s)?\b/i, '📝'],
];
function decorateEmoji(text, maxPerPara = 3) {
  let count = 0;
  for (const [re, emo] of EMOJI_RULES) {
    if (count >= maxPerPara) break;
    const m = text.match(re);
    if (m) {
      // insère l'emoji juste après la 1re occurrence du mot-clé
      text = text.slice(0, m.index + m[0].length) + ' ' + emo + text.slice(m.index + m[0].length);
      count++;
    }
  }
  return text;
}

/** Fiche mémo : présentation pédagogique du produit + toutes les réponses (révision). */
function openMemo(root, chapter) {
  audio.sfx('uiClick');
  const emo = CHAPTER_EMOJI[chapter.id] || '📘';
  const ov = document.createElement('div');
  ov.className = 'memo-overlay';
  ov.innerHTML = `
    <div class="memo-card">
      <div class="memo-head">
        <div><h2><span class="memo-emoji">${emo}</span> ${chapter.title}</h2><div class="memo-sub">${t('memoTitle')} · ${chapter.short}</div></div>
        <button class="btn btn-ghost memo-close">✕ ${t('memoClose')}</button>
      </div>
      <div class="memo-body">
        <p class="memo-hint">📌 ${t('memoHint')}</p>
        <h3>📘 ${t('memoIntro')}</h3>
        <div class="memo-intro">${chapter.intro.map(p => `<p>${decorateEmoji(p)}</p>`).join('')}</div>
        <h3 class="mt">✅ ${t('memoTrue')} (${chapter.vrai.length})</h3>
        <ul class="memo-list mt">${chapter.vrai.map(s => `<li><span>${s}</span></li>`).join('')}</ul>
        <h3 class="mf">❌ ${t('memoFalse')} (${chapter.faux.length})</h3>
        <ul class="memo-list mf">${chapter.faux.map(s => `<li><span>${s}</span></li>`).join('')}</ul>
      </div>
    </div>`;
  root.appendChild(ov);
  const close = () => { audio.sfx('uiClick'); ov.remove(); };
  ov.querySelector('.memo-close').addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
}

// ─────────────────────────── PRÉ-COURSE ───────────────────────────
export function renderPreCourse(ctx, { courseId }) {
  clear(ctx.root);
  const course = COURSES.find(c => c.id === courseId);
  const chapter = getChapter(course.chapter);
  const settings = getSettings();
  const prog = getCourseProgress(courseId);
  const nLevels = BALANCE.difficulty.levels.length;
  const step = 1 / (nLevels - 1);
  // Difficulté discrète (5 crans) : on aligne la valeur initiale sur un cran.
  let slider = difficultyIndexFromSlider(settings.lastDifficulty ?? 0.25) * step;
  const el = document.createElement('div');
  el.className = 'screen precourse-screen';
  el.innerHTML = `
    <header class="screen-head">
      <button class="btn btn-ghost" data-back>${t('preRaceBack')}</button>
      <h2>${course.name} · ${course.country}</h2><div></div>
    </header>
    <div class="precourse-body">
      <div class="course-preview"><canvas class="preview-canvas"></canvas>
        <p class="course-tag">${course.tagline}</p>
      </div>
      <div class="precourse-info">
        ${chapter ? `<div class="product-banner">
          <span class="product-label">${t('preRaceProduct')}</span>
          <strong class="product-name">${chapter.title}</strong>
          <button class="btn memo-btn">${t('memoOpen')}</button>
        </div>` : ''}
        <div class="info-row"><span>${t('preRaceBuoys')}</span><strong>${course.marks.length}</strong></div>
        <div class="info-row"><span>${t('preRaceWind')}</span><strong>${Math.round(course.wind.strength * 20)} nds</strong></div>
        <div class="info-row rivals"><span>${t('preRaceRivals')}</span>
          <span class="rival-dots">${TEAMS.slice(1).map(tm => `<i style="background:${tm.color}" title="${tm.name}"></i>`).join('')}</span>
        </div>
        <div class="difficulty">
          <label>${t('preRaceDifficulty')} : <strong class="diff-label"></strong></label>
          <input type="range" class="diff-slider" min="0" max="1" step="${step}" value="${slider}">
          <div class="diff-scale">${BALANCE.difficulty.levels.map(l => `<span>${l.label}</span>`).join('')}</div>
        </div>
        <div class="precourse-trophies">
          <span class="pt-label">${t('mapTrophies')} : <strong class="pt-count">${prog.trophies.filter(Boolean).length}</strong>/5</span>
          <span class="pt-row"></span>
        </div>
        <button class="btn btn-primary big start-btn">🚩 ${t('preRaceStart')}</button>
      </div>
    </div>
  `;
  ctx.root.appendChild(el);
  drawCoursePreview(el.querySelector('.preview-canvas'), course);
  if (chapter) {
    const memoBtn = el.querySelector('.memo-btn');
    btnSfx(memoBtn);
    memoBtn.addEventListener('click', () => openMemo(el, chapter));
  }
  const diffSlider = el.querySelector('.diff-slider');
  const diffLabel = el.querySelector('.diff-label');
  const ptRow = el.querySelector('.pt-row');
  const upd = () => {
    const v = parseFloat(diffSlider.value);
    const idx = difficultyIndexFromSlider(v);
    diffLabel.textContent = BALANCE.difficulty.levels[idx].label;
    // Met en avant le trophée de la difficulté sélectionnée.
    ptRow.innerHTML = trophiesHTML(prog.trophies, { current: idx });
  };
  upd();
  diffSlider.addEventListener('input', () => { upd(); setSetting('lastDifficulty', parseFloat(diffSlider.value)); });
  const startBtn = el.querySelector('.start-btn');
  btnSfx(startBtn);
  startBtn.addEventListener('click', () => ctx.go('race', { courseId, slider: parseFloat(diffSlider.value) }));
  el.querySelector('[data-back]').addEventListener('click', () => { audio.sfx('uiClick'); ctx.go('campaign'); });
}

function drawCoursePreview(canvas, course) {
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; draw(); };
  function draw() {
    const w = canvas.width, h = canvas.height;
    const pad = 26;
    const sx = (w - pad * 2) / BALANCE.world.width, sy = (h - pad * 2) / BALANCE.world.height;
    const s = Math.min(sx, sy);
    const mp = (x, y) => ({ x: pad + x * s, y: pad + y * s });
    ctx.fillStyle = '#0a3a5f'; ctx.fillRect(0, 0, w, h);
    // courants
    for (const c of course.currents || []) {
      const p = mp(c.x, c.y);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, c.r * s);
      g.addColorStop(0, 'rgba(60,220,200,0.2)'); g.addColorStop(1, 'rgba(60,220,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, c.r * s, 0, Math.PI * 2); ctx.fill();
    }
    // tracé
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath();
    const st = mp(course.start.x, course.start.y); ctx.moveTo(st.x, st.y);
    course.marks.forEach(m => { const p = mp(m.x, m.y); ctx.lineTo(p.x, p.y); });
    ctx.lineTo(st.x, st.y); ctx.stroke(); ctx.setLineDash([]);
    // marks
    course.marks.forEach((m, i) => {
      const p = mp(m.x, m.y);
      ctx.fillStyle = '#ff9f43'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(i + 1, p.x, p.y - 8);
    });
    // départ
    ctx.fillStyle = '#4dff88'; ctx.beginPath(); ctx.arc(st.x, st.y, 6, 0, Math.PI * 2); ctx.fill();
    // vent
    ctx.save(); ctx.translate(w - 34, 30); ctx.rotate(course.wind.dir);
    ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(6, -5); ctx.moveTo(12, 0); ctx.lineTo(6, 5); ctx.stroke();
    ctx.restore();
  }
  resize();
  window.addEventListener('resize', resize);
  canvas._stop = () => window.removeEventListener('resize', resize);
}

// ─────────────────────────── PODIUM / RÉSULTATS ───────────────────────────
export function renderPodium(ctx, { results, won, courseId, slider, diffIndex, recordInfo, stats }) {
  clear(ctx.root);
  audio.playMusic('menu');
  const idx = courseIndex(courseId);
  const course = COURSES[idx];
  const nextCourse = COURSES[idx + 1];
  const nextUnlocked = nextCourse && isUnlocked(idx + 1);
  const acc = stats.questions ? Math.round(stats.correct / stats.questions * 100) : 0;
  const bestReply = stats.bestReplyMs === Infinity ? '—' : (stats.bestReplyMs / 1000).toFixed(2) + ' s';
  const player = results.find(r => r.isPlayer) || results[0];
  const playerPos = results.indexOf(player) + 1;
  const total = results.length;
  const trophyCount = (recordInfo.trophies || []).filter(Boolean).length;
  const medalFor = (p) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}ᵉ`);

  const el = document.createElement('div');
  el.className = `screen podium-screen ${won ? 'is-victory' : 'is-defeat'}`;
  el.innerHTML = `
    ${won ? '<canvas class="confetti"></canvas>' : ''}
    <div class="results">
      <div class="results-head">🏁 ${course.name} · ${course.country}</div>
      <h1 class="results-title">${won ? t('podiumVictory') : t('podiumDefeat')}</h1>

      <div class="time-hero">
        <div class="th-rank">
          <span class="th-medal">${medalFor(playerPos)}</span>
          <span class="th-team" style="--c:${player.color}">${player.name}</span>
        </div>
        <div class="th-time">
          <div class="th-time-label">${t('podiumYourTime')}</div>
          <div class="th-time-value">${fmtTime(player.time * 1000)}</div>
        </div>
        <div class="th-badges">
          ${recordInfo.isRecord ? `<span class="badge badge-record">⭐ ${t('podiumNewRecord')}</span>` : ''}
          ${recordInfo.newTrophy ? `<span class="badge badge-trophy">🏆 ${BALANCE.difficulty.levels[diffIndex].label}</span>` : ''}
          <span class="badge badge-pos">${t('podiumPosition')} ${playerPos}/${total}</span>
        </div>
      </div>

      <div class="podium-medals">
        ${results.slice(0, 3).map((r, i) => `
          <div class="pm pm-${i + 1} ${r.isPlayer ? 'me' : ''}">
            <span class="pm-medal">${medalFor(i + 1)}</span>
            <span class="pm-dot" style="background:${r.color}"></span>
            <span class="pm-name">${r.name}</span>
            <span class="pm-time">${fmtTime(r.time * 1000)}</span>
          </div>`).join('')}
      </div>

      <div class="results-grid">
        <div class="rg-panel">
          <h3>${t('podiumRank')}</h3>
          <ol class="rank-list">
            ${results.map((r, i) => `<li class="${r.isPlayer ? 'me' : ''}"><span class="pos">${medalFor(i + 1)}</span><i style="background:${r.color}"></i><span class="nm">${r.name}</span><span class="tm">${fmtTime(r.time * 1000)}</span></li>`).join('')}
          </ol>
        </div>
        <div class="rg-panel">
          <h3>${t('podiumStats')}</h3>
          <div class="stats-chips">
            <div class="chip"><span>${t('podiumQuestions')}</span><strong>${stats.questions}</strong></div>
            <div class="chip"><span>${t('podiumAccuracy')}</span><strong>${acc}%</strong></div>
            <div class="chip"><span>${t('podiumBestReply')}</span><strong>${bestReply}</strong></div>
            <div class="chip"><span>${t('podiumTopSpeed')}</span><strong>${Math.round(stats.topSpeedKnots)} nds</strong></div>
          </div>
          <div class="trophies-inline">
            <span class="pt-label">${t('podiumTrophies')} : <strong>${trophyCount}</strong>/5</span>
            ${trophiesHTML(recordInfo.trophies, { earnedNow: recordInfo.newTrophy ? diffIndex : -1 })}
          </div>
        </div>
      </div>

      <div class="podium-bottom">
        <div class="podium-replay-diff">
          <label>${t('preRaceDifficulty')} (Rejouer) : <strong class="pr-diff-label"></strong></label>
          <input type="range" class="pr-diff-slider" min="0" max="1" step="${1 / (BALANCE.difficulty.levels.length - 1)}" value="${slider}">
        </div>
        <div class="podium-actions">
          <button class="btn" data-act="replay">↻ ${t('podiumReplay')}</button>
          ${nextCourse && nextUnlocked ? `<button class="btn btn-primary" data-act="next">${t('podiumNext')} →</button>` : ''}
          <button class="btn btn-ghost" data-act="map">${t('podiumMap')}</button>
        </div>
      </div>
    </div>
  `;
  ctx.root.appendChild(el);
  if (won) confetti(el.querySelector('.confetti'));
  // Sélecteur de difficulté pour Rejouer (5 crans), pré-réglé sur la partie jouée.
  const prDiff = el.querySelector('.pr-diff-slider');
  const prLabel = el.querySelector('.pr-diff-label');
  const updPr = () => { prLabel.textContent = BALANCE.difficulty.levels[difficultyIndexFromSlider(parseFloat(prDiff.value))].label; };
  updPr();
  prDiff.addEventListener('input', () => { updPr(); setSetting('lastDifficulty', parseFloat(prDiff.value)); });
  el.querySelectorAll('button[data-act]').forEach(b => {
    btnSfx(b);
    b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'replay') ctx.go('race', { courseId, slider: parseFloat(prDiff.value) });
      else if (a === 'next') ctx.go('precourse', { courseId: nextCourse.id });
      else ctx.go('campaign');
    });
  });
}

function confetti(canvas) {
  const ctx = canvas.getContext('2d');
  const cols = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#f783ac', '#fff'];
  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Densité proportionnelle à la surface de l'écran.
  let parts = [];
  const spawn = () => {
    const count = Math.round(Math.max(90, (W * H) / 9000));
    parts = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: -Math.random() * H,
      vy: 60 + Math.random() * 140, vx: (Math.random() - 0.5) * 70,
      s: 4 + Math.random() * 7, c: cols[Math.floor(Math.random() * cols.length)], r: Math.random() * Math.PI,
    }));
  };
  const resize = () => {
    // Plein écran : la fenêtre, pas la boîte parente (le canvas est position:fixed inset:0).
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    spawn();
  };
  resize();
  window.addEventListener('resize', resize);
  let t0 = performance.now(), raf;
  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y += p.vy * dt; p.x += p.vx * dt; p.r += dt * 4;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  canvas._stop = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}

// ─────────────────────────── RÉGLAGES ───────────────────────────
export function renderSettings(ctx) {
  clear(ctx.root);
  const s = getSettings();
  const el = document.createElement('div');
  el.className = 'screen settings-screen';
  el.innerHTML = `
    <header class="screen-head">
      <button class="btn btn-ghost" data-back>${t('settingsBack')}</button>
      <h2>${t('settingsTitle')}</h2><div></div>
    </header>
    <div class="settings-body">
      <label class="slider-row"><span>🎵 ${t('settingsMusic')}</span>
        <input type="range" min="0" max="1" step="0.02" value="${s.musicVolume}" class="music-vol"></label>
      <label class="slider-row"><span>🔊 ${t('settingsSfx')}</span>
        <input type="range" min="0" max="1" step="0.02" value="${s.sfxVolume}" class="sfx-vol"></label>
      <button class="btn btn-danger reset-btn">🗑️ ${t('settingsReset')}</button>
    </div>
    <div class="modal-overlay hidden reset-modal">
      <div class="modal-card">
        <p>${t('settingsResetConfirm')}</p>
        <div class="modal-actions">
          <button class="btn btn-danger confirm-reset">${t('settingsResetYes')}</button>
          <button class="btn btn-ghost cancel-reset">${t('settingsResetNo')}</button>
        </div>
      </div>
    </div>
  `;
  ctx.root.appendChild(el);
  const music = el.querySelector('.music-vol'), sfx = el.querySelector('.sfx-vol');
  music.addEventListener('input', () => audio.setMusicVolume(parseFloat(music.value)));
  sfx.addEventListener('input', () => audio.setSfxVolume(parseFloat(sfx.value)));
  sfx.addEventListener('change', () => audio.sfx('uiClick'));
  const modal = el.querySelector('.reset-modal');
  el.querySelector('.reset-btn').addEventListener('click', () => { audio.sfx('uiClick'); modal.classList.remove('hidden'); });
  el.querySelector('.cancel-reset').addEventListener('click', () => { audio.sfx('uiClick'); modal.classList.add('hidden'); });
  el.querySelector('.confirm-reset').addEventListener('click', () => {
    resetSave(); audio.sfx('unlock'); modal.classList.add('hidden');
    music.value = getSettings().musicVolume; sfx.value = getSettings().sfxVolume;
  });
  el.querySelector('[data-back]').addEventListener('click', () => { audio.sfx('uiClick'); ctx.go('menu'); });
}

// ─────────────────────────── CRÉDITS ───────────────────────────
export function renderCredits(ctx) {
  clear(ctx.root);
  const el = document.createElement('div');
  el.className = 'screen credits-screen';
  el.innerHTML = `
    <header class="screen-head">
      <button class="btn btn-ghost" data-back>${t('creditsBack')}</button>
      <h2>${t('creditsTitle')}</h2><div></div>
    </header>
    <div class="credits-body"><pre>${t('creditsBody')}</pre></div>
  `;
  ctx.root.appendChild(el);
  el.querySelector('[data-back]').addEventListener('click', () => { audio.sfx('uiClick'); ctx.go('menu'); });
}

// ─────────────────────────── TUTORIEL ───────────────────────────
export function createTutorial(root, { onBegin, onGuideDone, onQuit } = {}) {
  const steps = [
    { key: 'tutStep1', advance: 'next' },
    { key: 'tutStep2', advance: 'question' },
    { key: 'tutStep3', advance: 'maneuver' },
    { key: 'tutStep4', advance: 'next' },
    { key: 'tutStep5', advance: 'buoy' },
    { key: 'tutStep6', advance: 'finish-btn' },
  ];
  let i = 0;
  const el = document.createElement('div');
  el.className = 'tutorial-layer';
  el.innerHTML = `<div class="tut-card"><p class="tut-text"></p><button class="btn btn-primary tut-btn"></button></div>`;
  root.appendChild(el);
  const textEl = el.querySelector('.tut-text');
  const btn = el.querySelector('.tut-btn');

  // Bouton « Quitter le tutoriel » toujours visible en haut à gauche.
  const quitBtn = document.createElement('button');
  quitBtn.className = 'btn btn-ghost tut-quit';
  quitBtn.textContent = t('tutQuit');
  quitBtn.addEventListener('click', () => { audio.sfx('uiClick'); onQuit && onQuit(); });
  root.appendChild(quitBtn);

  function show() {
    const s = steps[i];
    textEl.textContent = t(s.key);
    btn.textContent = i === steps.length - 1 ? t('tutFinish') : (s.advance === 'next' || s.advance === 'finish-btn' ? t('tutNext') : '⏳ …');
    btn.classList.toggle('hidden', !(s.advance === 'next' || s.advance === 'finish-btn'));
    el.classList.remove('hidden');
  }
  function advance() {
    // Le 1er dialogue passé → la course (top départ) peut démarrer.
    if (i === 0 && onBegin) onBegin();
    i++;
    if (i >= steps.length) {
      // Dernier dialogue passé : on masque le guide, le joueur peut FINIR la course.
      el.remove();
      onGuideDone && onGuideDone();
      return;
    }
    show();
  }
  btn.addEventListener('click', () => { audio.sfx('uiClick'); advance(); });
  show();

  return {
    notify(event) {
      const s = steps[i];
      if (!s) return;
      if (s.advance === event) advance();
    },
    destroy() { el.remove(); quitBtn.remove(); },
  };
}
