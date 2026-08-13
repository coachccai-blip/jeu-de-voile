/**
 * raceIntro.js — Écran d'intro d'une course : un présentateur drôle (« Max Écume »)
 * lance une réplique courte et spécifique au parcours. La course (top départ) ne
 * démarre qu'une fois le dialogue passé par le joueur.
 */
import { t } from '../i18n/strings.js';
import { audio } from '../audio/audio.js';

export function showRaceIntro(root, course, onStart) {
  const el = document.createElement('div');
  el.className = 'race-intro';
  el.innerHTML = `
    <div class="intro-card">
      <div class="presenter">
        <div class="presenter-avatar">🎙️</div>
        <div class="presenter-id">
          <strong>${t('presenterName')}</strong>
          <span>${t('presenterRole')}</span>
        </div>
      </div>
      <div class="intro-venue">${course.name} · ${course.country}</div>
      <p class="intro-line">« ${course.intro || course.tagline} »</p>
      <button class="btn btn-primary big intro-go">${t('introStart')}</button>
    </div>
  `;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  const goBtn = el.querySelector('.intro-go');
  goBtn.addEventListener('mouseenter', () => audio.sfx('uiHover'));
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 260);
  };
  goBtn.addEventListener('click', () => {
    audio.sfx('countBeep');
    close();
    onStart && onStart();
  });
  return { close, el };
}
