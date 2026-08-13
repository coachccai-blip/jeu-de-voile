/**
 * qcm.js — Panneau QCM en course.
 * Non intrusif (bas d'écran), 4 boutons larges (tactile ≥ 44px), barre de chrono.
 * Réponse au clic ou aux touches 1-4. Renvoie l'index choisi via onAnswer.
 */
import { audio } from '../audio/audio.js';
import { t } from '../i18n/strings.js';

export class QCM {
  constructor(root, onAnswer) {
    this.onAnswer = onAnswer;
    this.el = document.createElement('div');
    this.el.className = 'qcm hidden';
    this.el.innerHTML = `
      <div class="qcm-timer"><div class="qcm-timer-fill"></div></div>
      <div class="qcm-prompt"></div>
      <div class="qcm-choices"></div>
    `;
    root.appendChild(this.el);
    this.timerFill = this.el.querySelector('.qcm-timer-fill');
    this.promptEl = this.el.querySelector('.qcm-prompt');
    this.choicesEl = this.el.querySelector('.qcm-choices');
    this.active = false;
    this._keyHandler = (e) => {
      if (!this.active) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) this._answer(n - 1);
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  show(q) {
    this.active = true;
    this.locked = false;
    this.promptEl.textContent = `${q.prompt} = ?`;
    this.choicesEl.innerHTML = '';
    q.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'qcm-choice';
      b.innerHTML = `<span class="qcm-num">${i + 1}</span><span class="qcm-val">${c}</span>`;
      b.addEventListener('click', () => this._answer(i));
      this.choicesEl.appendChild(b);
    });
    this.el.classList.remove('hidden', 'answered');
    requestAnimationFrame(() => this.el.classList.add('show'));
  }

  _answer(i) {
    if (!this.active || this.locked) return;
    this.locked = true;
    // Libère aussitôt le bas de l'écran (le joueur peut cliquer pour choisir son cap).
    this.el.classList.add('answered');
    this.onAnswer(i);
  }

  tick(remaining, frac) {
    this.timerFill.style.width = `${Math.max(0, frac) * 100}%`;
    this.timerFill.classList.toggle('urgent', frac < 0.35);
  }

  result(correct, chosenIndex, correctIndex) {
    const btns = [...this.choicesEl.children];
    btns.forEach((b, i) => {
      if (i === correctIndex) b.classList.add('correct');
      if (i === chosenIndex && !correct) b.classList.add('wrong');
    });
    const label = document.createElement('div');
    label.className = `qcm-verdict ${correct ? 'ok' : 'ko'}`;
    label.textContent = correct ? t('qcmCorrect') : (chosenIndex < 0 ? t('qcmTimeUp') : t('qcmWrong'));
    this.el.appendChild(label);
    this.active = false;
    // Correct : le panneau disparaît quasi immédiatement pour laisser cliquer en bas.
    // Faux : on laisse voir la bonne réponse un court instant (pas de choix de cap).
    setTimeout(() => this.hide(label), correct ? 130 : 620);
  }

  hide(label) {
    this.el.classList.remove('show');
    setTimeout(() => {
      this.el.classList.add('hidden');
      if (label && label.parentNode) label.remove();
    }, 220);
    this.active = false;
  }

  destroy() {
    window.removeEventListener('keydown', this._keyHandler);
    this.el.remove();
  }
}
