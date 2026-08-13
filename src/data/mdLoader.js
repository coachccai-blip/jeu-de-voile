/**
 * mdLoader.js — Loader + SPÉCIFICATION du format Markdown pour banques de questions.
 *
 * Hors périmètre v1 pour l'UI d'import, mais le format et le parseur sont fournis
 * pour préparer l'avenir (une course pourra pointer vers sa propre banque .md).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FORMAT `.md` d'une banque de questions
 * ─────────────────────────────────────────────────────────────────────────────
 * Front-matter YAML optionnel entre --- :
 *   ---
 *   id: geo-europe
 *   label: Capitales d'Europe
 *   timeLimit: 8
 *   ---
 *
 * Puis une liste de questions. Chaque question est un bloc :
 *
 *   ## Quelle est la capitale de la France ?
 *   - [x] Paris
 *   - [ ] Lyon
 *   - [ ] Marseille
 *   - [ ] Bordeaux
 *
 * Règles :
 *  - Le titre `##` = énoncé (prompt).
 *  - Exactement 4 items `- [ ]` / `- [x]`, un seul coché `[x]` = bonne réponse.
 *  - `timeLimit` (secondes) hérité du front-matter, surchargé par la difficulté en jeu.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function parseMarkdownBank(text) {
  const meta = { id: 'md-bank', label: 'Banque importée', timeLimit: 8 };
  let body = text;

  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = text.slice(fm[0].length);
    fm[1].split('\n').forEach(line => {
      const m = line.match(/^(\w+)\s*:\s*(.+)$/);
      if (m) {
        const key = m[1].trim();
        let val = m[2].trim();
        if (key === 'timeLimit') val = parseFloat(val);
        meta[key] = val;
      }
    });
  }

  const questions = [];
  const blocks = body.split(/\n(?=##\s)/);
  for (const block of blocks) {
    const titleMatch = block.match(/^##\s+(.+)/);
    if (!titleMatch) continue;
    const prompt = titleMatch[1].trim();
    const choices = [];
    let correctIndex = -1;
    const optRe = /^-\s+\[([ xX])\]\s+(.+)$/gm;
    let m;
    while ((m = optRe.exec(block)) !== null) {
      if (m[1].toLowerCase() === 'x') correctIndex = choices.length;
      choices.push(m[2].trim());
    }
    if (choices.length === 4 && correctIndex >= 0) {
      questions.push({ prompt, choices, correctIndex });
    }
  }
  return { meta, questions };
}

/** Fabrique une banque compatible avec l'interface getNextQuestion(). */
export function bankFromMarkdown(text) {
  const { meta, questions } = parseMarkdownBank(text);
  let order = [];
  let cursor = 0;
  const reshuffle = () => {
    order = questions.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    cursor = 0;
  };
  reshuffle();
  return {
    id: meta.id,
    label: meta.label,
    getNextQuestion(difficulty) {
      if (questions.length === 0) return null;
      if (cursor >= order.length) reshuffle();
      const q = questions[order[cursor++]];
      return {
        prompt: q.prompt,
        choices: q.choices.slice(),
        correctIndex: q.correctIndex,
        timeLimit: (difficulty && difficulty.timeLimit) || meta.timeLimit,
      };
    },
  };
}
