/* =========================================================
   Skills: texts (read & listen), conversation, writing, sounds, lightning
   ========================================================= */
const TYPE_LABEL = { dialogue: 'Diálogo', story: 'História', news: 'Notícia de rádio', podcast: 'Podcast', essay: 'Artigo' };
const TYPE_ICON = { dialogue: 'chat', story: 'book', news: 'radio', podcast: 'ear', essay: 'text' };
function levelOpenFor(level) {
  const li = LEVELS.indexOf(level), si = LEVELS.indexOf(S.startLevel);
  if (li <= si + 1) return true;
  return levelPct(LEVELS[li - 1]) >= 30;
}
function textState(t) { return S.texts[t.id] || {}; }

/* ---------- text list ---------- */
function viewTexts(filter) {
  const page = h('div', { class: 'page' });
  const talk = filter === 'talk';
  put(page, subHead(talk ? 'Conversas' : 'Histórias e áudios', talk ? 'Você faz o papel de B: ouve a outra pessoa e responde em ' + LANG.name + ', falando ou digitando.' : 'Textos e áudios em contexto: diálogos, histórias, notícias de rádio, podcasts e artigos. Ouça primeiro, depois leia e responda.'));
  const lv = S.ui.textLevel && LEVELS.includes(S.ui.textLevel) ? S.ui.textLevel : 'all';
  put(page, h('div', { class: 'seg' }, h('button', { class: lv === 'all' ? 'on' : '', onclick: () => { S.ui.textLevel = 'all'; save(); render(); } }, 'Todos'),
    ...LEVELS.map(Lv => h('button', { class: lv === Lv ? 'on' : '', onclick: () => { S.ui.textLevel = Lv; save(); render(); } }, Lv))));
  const list = h('div', { class: 'tlist' });
  const items = TEXTS.filter(t => (!talk || t.type === 'dialogue') && (lv === 'all' || t.level === lv));
  items.forEach(t => {
    const st = textState(t), open = levelOpenFor(t.level);
    const status = talk ? (st.rp != null ? 'Melhor: ' + Math.round(st.rp * 100) + '%' : 'Nova') : (st.best != null ? 'Compreensão: ' + Math.round(st.best * 100) + '%' : 'Nova');
    const done = talk ? st.rp >= 0.7 : st.best >= 0.6;
    const b = h('button', { class: 'titem', 'aria-label': t.title + (open ? '' : ', bloqueado') },
      h('span', { class: 'ticon' }, icon(open ? TYPE_ICON[t.type] || 'text' : 'lock')),
      h('div', { style: { minWidth: 0 } }, h('b', null, t.title), h('span', null, t.level + ' · ' + TYPE_LABEL[t.type] + ' · ' + t.lines.length + ' falas')),
      h('span', { class: 'small ' + (done ? 'done' : 'muted') }, done ? icon('check') : open ? status : 'Bloqueado'));
    b.addEventListener('click', () => {
      if (!open) { toast('Este texto abre quando você tiver 30% do nível ' + LEVELS[LEVELS.indexOf(t.level) - 1] + ' ou mudar o nível inicial.'); return; }
      if (talk) openTalk(t); else openReader(t, st.listened ? 'read' : 'listen');
    });
    put(list, b);
  });
  if (!items.length) put(list, h('div', { class: 'panel empty muted' }, 'Nenhum texto neste filtro.'));
  put(page, list);
  return page;
}
function subHead(title, sub) {
  return h('div', { class: 'page-head' },
    h('div', { class: 'sub-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Voltar', onclick: () => { SUB = null; render(); window.scrollTo(0, 0); } }, icon('back')), h('h1', null, title)),
    sub ? h('p', { class: 'muted' }, sub) : null);
}

/* ---------- reader ---------- */
function voiceFor(sp) { return sp === 'B' ? { alt: true } : {}; }
function openReader(t, mode) {
  const inner = openStage(t.title, h('span', { class: 'pill lv' }, t.level));
  let showText = mode !== 'listen', showPt = false, rate = S.ui.gymRate || 1, tok = 0, playing = false;
  const wrap = h('div', { class: 'reader' + (showText ? '' : ' hide-text') });
  const lines = t.lines.map((ln, i) => {
    const row = h('div', { class: 'rline', tabindex: '0', role: 'button', 'aria-label': 'Ouvir fala ' + (i + 1) },
      h('span', { class: 'who' + (ln.s === 'B' ? ' b' : '') }, ln.s === 'N' ? '' : ln.s),
      h('span', { class: 'en', lang: LANG.code }, ln.en),
      h('span', { class: 'pt', hidden: true }, ln.pt));
    const act = () => { stopAll(); row.classList.add('playing'); speak(ln.en, { rate, ...voiceFor(ln.s), onend: () => row.classList.remove('playing') }); const pt = row.querySelector('.pt'); if (showText) pt.hidden = !pt.hidden; };
    row.addEventListener('click', act);
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    return row;
  });
  const playBtn = h('button', { class: 'btn', id: 'readerPlay' });
  const paintPlay = () => kids(playBtn, icon(playing ? 'pause' : 'play'), h('span', null, playing ? 'Pausar' : 'Ouvir tudo'));
  function stopAll() { tok++; playing = false; stopSpeak(); lines.forEach(r => r.classList.remove('playing')); paintPlay(); }
  async function playAll() {
    if (playing) { stopAll(); return; }
    const my = ++tok; playing = true; paintPlay();
    for (let i = 0; i < t.lines.length; i++) {
      if (my !== tok) return;
      lines.forEach(r => r.classList.remove('playing'));
      lines[i].classList.add('playing');
      try { lines[i].scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); } catch {}
      await speakP(t.lines[i].en, { rate, ...voiceFor(t.lines[i].s) });
      if (my !== tok) return;
      await wait(t.type === 'dialogue' ? 350 : 250);
    }
    if (my !== tok) return;
    lines.forEach(r => r.classList.remove('playing'));
    playing = false; paintPlay();
    S.texts[t.id] = { ...textState(t), listened: true }; save();
    if (!showText) { readHint.textContent = 'Pronto! Agora revele o texto, ouça de novo e confira o que você entendeu.'; textBtn.className = 'btn nudge'; }
  }
  paintPlay();
  playBtn.addEventListener('click', () => { if (!TTS.ok) { toast('Este navegador não tem voz em ' + LANG.name + '.', 'err'); return; } playAll(); });
  const textBtn = h('button', { class: 'btn ghost' });
  const paintText = () => { wrap.classList.toggle('hide-text', !showText); textBtn.textContent = showText ? 'Esconder texto' : 'Mostrar texto'; if (showText) textBtn.className = 'btn ghost'; };
  textBtn.addEventListener('click', () => { showText = !showText; paintText(); });
  const ptBtn = h('button', { class: 'btn ghost' }, 'Tradução');
  ptBtn.addEventListener('click', () => { showPt = !showPt; if (showPt && !showText) { showText = true; paintText(); } lines.forEach(r => { r.querySelector('.pt').hidden = !showPt; }); ptBtn.classList.toggle('on', showPt); });
  const rates = [[0.85, 'Calmo'], [1, 'Normal'], [1.15, 'Nativo']];
  const seg = h('div', { class: 'seg', 'aria-label': 'Velocidade' }, ...rates.map(([r, l]) => { const b = h('button', { class: rate === r ? 'on' : '' }, l); b.addEventListener('click', () => { rate = r; S.ui.gymRate = r; save(); $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); }); return b; }));
  paintText();
  const readHint = h('p', { class: 'small muted' }, showText ? 'Toque numa frase para ouvir e ver a tradução. Repita em voz alta as falas difíceis.' : 'Primeiro só ouça, sem ler: tente captar a ideia geral. Depois revele o texto e ouça de novo.');
  put(inner,
    h('div', { class: 'row' }, h('span', { class: 'pill' }, TYPE_LABEL[t.type]), h('span', { class: 'pill' }, t.topic)),
    readHint,
    h('div', { class: 'reader-ctrl' }, playBtn, textBtn, ptBtn), seg,
    wrap);
  lines.forEach(r => put(wrap, r));
  const qBtn = h('button', { class: 'btn big' }, 'Responder ' + t.q.length + ' perguntas');
  qBtn.addEventListener('click', () => startTextQuiz(t));
  const tb = t.type === 'dialogue' ? h('button', { class: 'btn ghost', onclick: () => { stopAll(); openTalk(t); } }, icon('chat'), 'Conversar') : null;
  stageFoot(tb, qBtn);
  ST.cleanup = () => { tok++; };
}
function startTextQuiz(t) {
  const items = t.q.map((q, i) => ({ type: 'mcq', p: { id: 'q:' + t.id + ':' + i, en: q.a, pt: '', q: q.q, a: q.a, o: q.o.slice(), level: t.level } }));
  closeStage({ keepHistory: true, silent: true });
  startLesson(items, { mode: 'text', fromStage: true, title: t.title, onFinish: acc => {
    const st = textState(t);
    const first = st.best == null || st.best < 0.6;
    S.texts[t.id] = { ...st, best: Math.max(st.best || 0, acc), done: today() };
    if (acc >= 0.6) {
      if (first) { S.stats.texts = (S.stats.texts || 0) + 1; addCoins(10); }
      questEvent('text', 1);
    }
    bump(); save();
  } });
}
function exMcq(it, inner) {
  const p = it.p;
  // questions are written in Portuguese up to A2 and in English from B1 on
  // comprehension questions are in Portuguese for A1–A2 and in the target language from B1 on
  const isPt = /\b(que|qual|quais|onde|quem|como|quando|quanto|quantas|quantos|por|para|ela|ele|pessoa|vai|fica|mora|deve|tem|faz|dele|dela|seu|sua|não|você)\b/i.test(p.q);
  choiceEx(inner, it, [...head('Compreensão'), h('div', { class: 'prompt-pt', lang: isPt ? 'pt-BR' : LANG.code }, p.q)], shuffle(p.o), p.a);
  foot(h('p', { class: 'small muted' }, 'Escolha uma opção ou use as teclas 1 a 4.'));
}

/* ---------- conversation (role-play) ---------- */
function openTalk(t) {
  const inner = openStage('Conversa: ' + t.title, h('span', { class: 'pill lv' }, t.level));
  ST.dirty = true;
  const chat = h('div', { class: 'chat', 'aria-live': 'polite' });
  const turn = h('div');
  const total = t.lines.filter(l => l.s === 'B').length;
  let i = 0, okN = 0, tok = 0, xp = 0;
  put(inner, h('p', { class: 'small muted' }, 'Você é a pessoa B. Ouça e responda em ' + LANG.name + ', falando no microfone ou digitando. Respostas com o mesmo sentido do modelo também valem.'), chat, turn);
  stageFoot(h('p', { class: 'small muted' }, 'Dica: fale frases completas, com calma.'));
  const scroll = () => { try { turn.scrollIntoView({ block: 'end', behavior: reduceMotion() ? 'auto' : 'smooth' }); } catch {} };
  ST.cleanup = () => { tok++; stopRec(); };
  async function step() {
    const my = tok;
    if (i >= t.lines.length) return finish();
    const ln = t.lines[i];
    if (ln.s !== 'B') {
      kids(turn, h('div', { class: 'bubble them' }, '…'));
      scroll();
      if (TTS.ok) await speakP(ln.en, voiceFor(ln.s)); else await wait(700);
      if (my !== tok) return;
      put(chat, h('div', { class: 'bubble them', lang: LANG.code }, ln.en, h('span', { class: 'sub' }, ln.pt)));
      kids(turn); i++; await wait(250); if (my !== tok) return; step(); return;
    }
    myTurn(ln);
  }
  function myTurn(ln) {
    let tries = 0, hinted = false;
    const heard = h('div', { class: 'heard', 'aria-live': 'polite' });
    const input = h('textarea', { class: 'typearea', rows: '2', placeholder: 'Ou digite sua resposta em ' + LANG.name, autocomplete: 'off', autocapitalize: 'sentences', spellcheck: 'false', lang: LANG.code, 'aria-label': 'Sua resposta', style: { minHeight: '76px' } });
    const send = h('button', { class: 'btn', disabled: true }, 'Enviar');
    input.addEventListener('input', () => { send.disabled = !input.value.trim(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.value.trim()) evaluate(input.value, false); } });
    send.addEventListener('click', () => evaluate(input.value, false));
    const hint = h('div', { class: 'hint' });
    const hintBtn = h('button', { class: 'btn ghost' }, 'Dica');
    hintBtn.addEventListener('click', () => { hinted = true; const w = ln.en.split(/\s+/); hint.textContent = w.slice(0, Math.min(3, Math.ceil(w.length / 3))).join(' ') + ' …'; });
    const modelBtn = h('button', { class: 'btn ghost', 'aria-label': 'Ouvir a resposta modelo' }, icon('speaker'));
    modelBtn.addEventListener('click', () => { hinted = true; speak(ln.en, voiceFor('B')); });
    const mic = canSpeak() ? h('button', { class: 'mic-btn small', 'aria-label': 'Falar' }, icon('mic')) : null;
    if (mic) mic.addEventListener('click', () => {
      if (activeRec) { try { activeRec.stop(); } catch {} return; }
      stopSpeak(); mic.classList.add('on'); heard.textContent = 'Ouvindo…';
      recognize({
        onInterim: tx => { if (tx) heard.textContent = '“' + tx + '”'; },
        onError: err => {
          mic.classList.remove('on');
          if (err === 'not-allowed' || err === 'service-not-allowed') { S.prefs.mic = false; save(); mic.remove(); heard.textContent = 'Microfone bloqueado. Digite sua resposta.'; input.focus(); }
          else if (err === 'no-speech') heard.textContent = 'Não ouvi nada. Tente de novo.';
          else if (err === 'network') heard.textContent = 'O reconhecimento de voz precisa de internet neste navegador. Você pode digitar.';
          else if (err !== 'aborted') heard.textContent = 'Não deu para ouvir. Tente de novo ou digite.';
        },
        onDone: alts => { mic.classList.remove('on'); if (!alts.length) { heard.textContent = 'Não entendi. Tente de novo.'; return; } S.stats.speaks++; evaluate(alts, true); }
      });
    });
    function evaluate(ans, spoken) {
      const cands = [ln.en, ...(ln.alt || [])];
      const tries2 = Array.isArray(ans) ? ans : [ans];
      let best = null;
      for (const a of tries2) for (const c of cands) { const r = align(c, a); if (!best || r.score > best.score) best = { ...r, text: a, ref: c }; }
      const thr = spoken ? 0.7 : 0.8;
      tries++;
      if (best.score >= thr) {
        okN++; const g = addXP(hinted ? 8 : 12); xp += g; SFX.ok(okN); buzz(12);
        put(chat, h('div', { class: 'bubble me', lang: LANG.code }, best.text, best.score < 0.97 ? h('span', { class: 'model' }, 'Modelo: ' + ln.en) : null));
        kids(turn); i++; setTimeout(step, 450); save();
      } else if (tries < 2) {
        SFX.bad(); heard.textContent = (spoken ? 'Ouvi: “' + best.text + '”. ' : '') + 'Quase! Tente de novo. Faltou: ' + (best.missing.slice(0, 4).join(', ') || 'algumas palavras') + '.';
        input.value = ''; send.disabled = true;
      } else {
        SFX.bad();
        put(chat, h('div', { class: 'bubble me bad', lang: LANG.code }, best.text || '—', h('span', { class: 'model' }, 'Modelo: ' + ln.en)));
        kids(turn); speak(ln.en, voiceFor('B')); i++; setTimeout(step, 1600);
      }
    }
    kids(turn, h('div', { class: 'turn-card' },
      h('span', { class: 'say' }, 'Sua vez. Diga em ' + LANG.name + ':'), h('div', { class: 'pt' }, ln.pt), hint,
      h('div', { class: 'row', style: { justifyContent: 'center' } }, mic, modelBtn, hintBtn), heard,
      h('div', { class: 'row' }, h('div', { class: 'grow' }, input), send)));
    scroll();
    if (!mic) setTimeout(() => input.focus({ preventScroll: true }), 80);
  }
  function finish() {
    ST.dirty = false;
    const sc = total ? okN / total : 1;
    const stars = sc >= 0.9 ? 3 : sc >= 0.7 ? 2 : sc >= 0.4 ? 1 : 0;
    const st = textState(t);
    S.texts[t.id] = { ...st, rp: Math.max(st.rp || 0, sc) };
    xp += addXP(20 + stars * 5); const c = addCoins(5 + stars * 5);
    S.stats.rp = (S.stats.rp || 0) + 1; questEvent('rp', 1); touchStreakSoft(); save(); checkAch();
    SFX.done(); if (stars >= 2) confetti(100);
    put(inner, h('div', { class: 'celebrate' }, starRow(stars), h('h2', null, okN + ' de ' + total + ' falas certas'), h('p', { class: 'muted' }, sc >= 0.7 ? 'Ótimo! Conversar em voz alta é o treino que mais aproxima você da fluência real.' : 'Repita a conversa: na segunda vez fica muito mais fácil, e é assim que a fala vira automática.'),
      h('div', { class: 'coins' }, '+' + xp + ' XP · ', icon('coin'), '+' + c)));
    stageFoot(h('button', { class: 'btn ghost', onclick: () => openTalk(t) }, 'Repetir'), h('button', { class: 'btn big', onclick: () => closeStage() }, 'Concluir'));
    setTimeout(() => { try { $('#stageBody').scrollTop = $('#stageBody').scrollHeight; } catch {} }, 60);
  }
  step();
}
function starRow(n) { return h('div', { class: 'stars', 'aria-label': n + ' de 3 estrelas' }, ...[0, 1, 2].map(i => h('span', { class: i < n ? 'on' : '' }, icon('star')))); }

/* ---------- writing ---------- */
const CONNECTORS_EN = ['and', 'but', 'because', 'so', 'then', 'also', 'after that', 'first', 'finally', 'when', 'however', 'although', 'while', 'for example', 'on the other hand', 'in addition', 'as a result', 'instead', 'unless', 'since', 'even though', 'in my opinion', 'furthermore', 'moreover', 'nevertheless', 'nonetheless', 'whereas', 'therefore', 'consequently', 'despite', 'in contrast', 'that said', 'having said that', 'overall', 'ultimately', 'granted', 'to sum up', 'in conclusion', 'not only', 'rather than', 'for instance', 'besides', 'meanwhile', 'otherwise', 'thus', 'hence', 'in fact', 'as long as', 'whether', 'if anything', 'far from'];
const CONN_TARGET = { A1: 2, A2: 3, B1: 4, B2: 5, C1: 6, C2: 6 };
// no regex lookbehind anywhere: older iPhones (Safari < 16.4) cannot even parse it
const AUX_BEFORE = /^(does|did|doesn't|didn't|can|could|will|would|should|might|must|may|won't|can't|couldn't|wouldn't|shouldn't|let|make|made|help|helped|to)$/i;
function heHave(t) {
  const re = /(?:\b([A-Za-z']+)\s+)?\b(she|he|it) have\b/gi; let m;
  while ((m = re.exec(t))) if (!m[1] || !AUX_BEFORE.test(m[1])) return [m[0].slice(m[1] ? m[1].length : 0).trim()];
  return null;
}
const L1_ERRORS = [
  [/\bI have (\d+|twenty|thirty|forty|fifty|sixty|eighteen|nineteen)\s+years\b(?!\s+(of|in|at|with|working|experience))/i, 'Idade usa "to be": I\'m 30 years old (não "I have 30 years").'],
  [/\bpeople is\b/i, '"People" é plural: people are.'],
  [/\bmake (a|the) question\b/i, 'Use "ask a question" (não "make a question").'],
  [/\bdepends? of\b/i, 'Use "depend on" (não "depend of").'],
  [/\bexplain (me|him|us)\b/i, 'Use "explain to me" (não "explain me").'],
  [/\b(I|we|they|you) (am|are|'m|'re) agree\b/i, '"Agree" é verbo: I agree (não "I am agree").'],
  [/\bmarried with\b/i, 'Use "married to" (não "married with").'],
  [/\bsince (\d+|two|three|four|five|six|seven|eight|nine|ten|a few|many) (years|months|days|weeks)\b/i, 'Para duração, use "for": for five years ("since" marca o início: since 2019).'],
  [/\bdiscuss(ed|ing)? about\b/i, '"Discuss" não leva "about": discuss the problem.'],
  [/\blisten(ed|ing|s)? (music|the radio|a song|songs|podcasts?|him|her|me)\b/i, 'Use "listen to": listen to music.'],
  [/\bmore (easy|cheap|big|small|fast|good|bad|nice|happy|hard|old|young|long|short|cold|hot)(?=\s+than\b|\s*[.,!?]|\s*$)/i, 'Adjetivos curtos usam -er: easier, cheaper, bigger, better.'],
  [/\bthe most (easy|cheap|big|small|fast|good|bad|nice|happy|hard)\b(?!-)/i, 'Superlativo de adjetivo curto: the easiest, the biggest, the best.'],
  [/\b(informations|advices|furnitures|homeworks|knowledges|equipments|researches)\b/i, 'Essa palavra é incontável em inglês e não vai para o plural (information, advice…).'],
  [/\b(didn't|did not|doesn't|does not|don't|do not) (went|was|had|did|saw|made|got|came|took|said|bought|thought|knew)\b/i, 'Depois de did/didn\'t/don\'t, use o verbo na forma base: didn\'t go.'],
  [/\bdid (you|he|she|they|we|I) (went|saw|made|got|came|took|said|bought|had)\b/i, 'Em perguntas com "did", o verbo fica na forma base: Did you go?'],
  [/\b(she|he|it) don't\b/i, 'Com he/she/it, use "doesn\'t".'],
  [heHave, 'Com he/she/it, use "has".'],
  [/\bmore better\b/i, 'Use só "better".'],
  [/\baccording with\b/i, 'Use "according to".'],
  [/\b(go|went|going|come|came|coming|arrive|arrived|get|got) to home\b/i, '"Home" sem "to": go home, arrive home, get home.'],
  [/\bassist(ed|ing)? (a|the|to) (movie|film|game|show|series|tv)\b/i, '"Assistir" a filme é "watch": watch a movie ("assist" = ajudar).'],
  [/\bthinking in (you|her|him|going|doing|moving|changing)\b/i, 'Use "thinking about/of": I\'m thinking about you.'],
  [/\bdream(ed|ing|s)? with\b/i, 'Use "dream of/about".'],
  [/\bconsists? in\b/i, 'Use "consist of".'],
  [/\bit('s| is) depend/i, 'Use "it depends".'],
  [/(^|[.!?]\s+)(have|has) (many|much)\b|\bhere (have|has) (a|an|many|some|much|a lot of)\b/im, 'Para "tem/existe", use "There is / There are".'],
  [/\bhow (is|are) (it|this|that|they) called\b/i, 'Use "What is it called?" (não "How is it called?").'],
  [/\bin the weekend\b/i, 'No inglês americano: "on the weekend".'],
  [/\bI pretend to (go|travel|study|move|buy|visit|live)\b/i, 'Atenção: "pretend" = fingir. Para "pretender" (ter a intenção), use "plan to" ou "intend to".'],
  [/\b(an information|an advice|a furniture|a homework)\b/i, 'Palavra incontável: some bread, a piece of advice, some news.'],
  [/(^|[.!?]\s+)the (life|nature|society|love) (is|are)\b/im, 'Em generalizações, não use "the": Life is…, People are…'],
  [/\b(is|are|was|were) born in (\d{1,2})\b(?!\d)/i, null],
  [/\bi\b(?!'|\.e\.)/, 'O pronome "I" é sempre maiúsculo.'],
  [/\bi'm\b|\bi've\b|\bi'll\b|\bi'd\b/, '"I" é sempre maiúsculo, inclusive em I\'m, I\'ve, I\'ll.']
].filter(x => x[1]);
const PT_HINT = /\b(que|não|você|para|com|uma|também|porque|muito|isso|está|então|mas|eu)\b/gi;
function hasChunk(text, chunk) {
  const T = (latin(text).replace(/[’‘]/g, "'").match(/[a-z']+/g) || []);
  const C = (latin(chunk).replace(/[’‘]/g, "'").match(/[a-z']+/g) || []);
  if (!C.length) return true;
  for (let i = 0; i < T.length; i++) {
    if (T[i] !== C[0]) continue;
    let j = i + 1, k = 1, gap = 0;
    while (k < C.length && j < T.length && gap <= 2) { if (T[j] === C[k]) { k++; gap = 0; } else gap++; j++; }
    if (k === C.length) return true;
  }
  return false;
}
function countWords(t) { return (latin(t).match(/[a-z]+(?:['’][a-z]+)?/g) || []).length; }
function analyzeWriting(w, text) {
  const words = countWords(text);
  const low = ' ' + latin(text).replace(/[’‘]/g, "'") + ' ';
  const chunks = w.use.map(u => ({ u, ok: hasChunk(text, u) }));
  const conns = LANG.connectors.filter(c => new RegExp('(^|[^a-z])' + latin(c).replace(/[^a-z' ]/g, '').replace(/ /g, '\\s+') + '([^a-z]|$)', 'i').test(low));
  const toks = (latin(text).match(/[a-z']+/g) || []).slice(0, 120);
  const ttr = toks.length ? new Set(toks).size / toks.length : 0;
  const sentences = (text.match(/[^.!?]+[.!?]*/g) || []).map(x => x.trim()).filter(x => /[A-Za-z]/.test(x));
  const fixes = [];
  for (const [re, msg] of LANG.l1) { const m = typeof re === 'function' ? re(text) : text.match(re); if (m) fixes.push({ msg, ex: String(m[0] || '').trim() }); }
  const noCap = sentences.filter(x => /^[a-zà-ÿ]/.test(x)).length;
  if (noCap) fixes.push({ msg: 'Comece cada frase com letra maiúscula.', ex: sentences.find(x => /^[a-zà-ÿ]/.test(x)).slice(0, 40) });
  if (sentences.length && !/[.!?]["”')]?\s*$/.test(text.trim())) fixes.push({ msg: 'Termine o texto com ponto final.', ex: '' });
  const ptCount = (text.match(PT_HINT) || []).length;
  const ptWarn = ptCount >= 3;
  const s = {
    length: Math.min(1, words / w.min),
    chunks: chunks.filter(c => c.ok).length / chunks.length,
    conn: Math.min(1, conns.length / (CONN_TARGET[w.level] || 3)),
    variety: toks.length < 20 ? Math.min(1, ttr) : clamp((ttr - 0.35) / 0.25, 0, 1),
    mech: Math.max(0, 1 - fixes.length * 0.15)
  };
  let total = s.length * 0.25 + s.chunks * 0.25 + s.conn * 0.2 + s.variety * 0.15 + s.mech * 0.15;
  if (ptWarn) total *= 0.4;
  const stars = total >= 0.85 ? 3 : total >= 0.65 ? 2 : total >= 0.4 ? 1 : 0;
  return { words, chunks, conns, ttr, sentences: sentences.length, fixes, s, total, stars, ptWarn };
}
function viewWritingList() {
  const page = h('div', { class: 'page' });
  put(page, subHead('Escrita guiada', 'Escrever obriga o cérebro a buscar palavras e estruturas, e comparar com um texto-modelo mostra exatamente o que falta (efeito de "notar a diferença").'));
  const list = h('div', { class: 'tlist' });
  WRITING.forEach(w => {
    const hist = (S.writing[w.id] && S.writing[w.id].hist) || [];
    const best = hist.reduce((a, b) => Math.max(a, b.stars || 0), -1);
    const open = levelOpenFor(w.level);
    const b = h('button', { class: 'titem' }, h('span', { class: 'ticon' }, icon(open ? 'pen' : 'lock')),
      h('div', { style: { minWidth: 0 } }, h('b', null, w.title), h('span', null, w.level + ' · mínimo ' + w.min + ' palavras')),
      best >= 0 ? starRowSmall(best) : h('span', { class: 'small muted' }, open ? 'Nova' : 'Bloqueada'));
    b.addEventListener('click', () => { if (!open) { toast('Abre com 30% do nível anterior ou mudando o nível inicial.'); return; } openWriting(w); });
    put(list, b);
  });
  put(page, list);
  return page;
}
function starRowSmall(n) { return h('span', { class: 'small', style: { color: 'var(--amber)', fontWeight: '800' }, 'aria-label': n + ' estrelas' }, '★'.repeat(n) + '☆'.repeat(3 - n)); }
function openWriting(w, keepText) {
  const inner = openStage('Escrita: ' + w.title, h('span', { class: 'pill lv' }, w.level));
  const rec = S.writing[w.id] || (S.writing[w.id] = { hist: [], draft: '' });
  const ta = h('textarea', { class: 'wbox', placeholder: 'Escreva aqui, em ' + LANG.name + '…', spellcheck: 'false', autocapitalize: 'sentences', lang: LANG.code, 'aria-label': 'Seu texto em ' + LANG.name, id: 'wbox' });
  ta.value = keepText != null ? keepText : (rec.draft || '');
  const count = h('div', { class: 'wcount' });
  const chips = h('div', { class: 'chips' });
  const done = h('button', { class: 'btn big' }, 'Concluir e avaliar');
  let tmr = 0;
  const paint = () => {
    const n = countWords(ta.value);
    count.textContent = n + ' / ' + w.min + ' palavras'; count.classList.toggle('ok', n >= w.min);
    kids(chips, ...w.use.map(u => h('span', { class: 'wchip' + (hasChunk(ta.value, u) ? ' ok' : '') }, u)));
    done.disabled = n < 8;
    ST.dirty = n > 0;
  };
  ta.addEventListener('input', () => { paint(); clearTimeout(tmr); tmr = setTimeout(() => { rec.draft = ta.value; save(); }, 600); });
  const listen = h('button', { class: 'btn ghost', 'aria-label': 'Ouvir meu texto' }, icon('speaker'), 'Ouvir');
  listen.addEventListener('click', () => { if (ta.value.trim()) speak(ta.value.slice(0, 1200)); });
  done.addEventListener('click', () => { rec.draft = ta.value; save(); showWritingReport(w, ta.value); });
  put(inner,
    h('div', { class: 'wtask' }, h('b', null, 'Proposta'), h('p', null, w.task), h('span', { class: 'small muted' }, 'Use estas expressões (elas ficam verdes quando aparecem no seu texto):'), chips),
    ta, h('div', { class: 'row' }, count, h('span', { class: 'grow' }), listen));
  stageFoot(done);
  ST.cleanup = () => { clearTimeout(tmr); rec.draft = ta.value; save(); };
  paint();
  setTimeout(() => ta.focus({ preventScroll: true }), 120);
}
function highlightChunks(text, chunks) {
  const el = h('div', { class: 'model-text', lang: LANG.code });
  let rest = text;
  const marks = [];
  chunks.forEach(c => { const i = rest.toLowerCase().indexOf(c.toLowerCase()); if (i >= 0) marks.push([i, i + c.length]); });
  marks.sort((a, b) => a[0] - b[0]);
  let pos = 0;
  for (const [a, b] of marks) { if (a < pos) continue; put(el, text.slice(pos, a), h('mark', null, text.slice(a, b))); pos = b; }
  put(el, text.slice(pos));
  return el;
}
function showWritingReport(w, text) {
  const r = analyzeWriting(w, text);
  const inner = openStage('Resultado: ' + w.title, h('span', { class: 'pill lv' }, w.level));
  ST.dirty = false;
  const rec = S.writing[w.id] || (S.writing[w.id] = { hist: [], draft: '' });
  const prevBest = rec.hist.reduce((a, b) => Math.max(a, b.stars || 0), 0);
  rec.hist.push({ d: today(), words: r.words, stars: r.stars });
  rec.hist = rec.hist.slice(-8);
  rec.last = text.slice(0, 4000);
  const g = addXP(20 + r.stars * 10); const c = addCoins(r.stars * 8 + (r.stars > prevBest ? 10 : 0));
  S.stats.writings = (S.stats.writings || 0) + 1; questEvent('write', 1); touchStreakSoft(); save(); checkAch();
  SFX.done(); if (r.stars >= 2) confetti(100);
  const check = (ok, txt) => h('div', { class: 'wcheck ' + (ok ? 'ok' : 'no') }, icon(ok ? 'check' : 'target'), h('span', null, txt));
  put(inner, h('div', { class: 'celebrate', style: { paddingTop: '8px' } }, starRow(r.stars), h('div', { class: 'coins' }, '+' + g + ' XP · ', icon('coin'), '+' + c)),
    r.ptWarn ? h('div', { class: 'wfix' }, 'Parece que parte do texto está em português. Tente escrever tudo em ' + LANG.name + ', mesmo que simples.') : null,
    h('div', { class: 'wreport' },
      check(r.words >= w.min, r.words + ' palavras (meta: ' + w.min + ').'),
      check(r.s.chunks === 1, 'Expressões pedidas: ' + r.chunks.filter(x => x.ok).length + ' de ' + r.chunks.length + (r.chunks.some(x => !x.ok) ? ' (faltou: ' + r.chunks.filter(x => !x.ok).map(x => x.u).join(', ') + ')' : '') + '.'),
      check(r.s.conn >= 1, 'Conectores usados: ' + (r.conns.length ? r.conns.join(', ') : 'nenhum') + '. Para o ' + w.level + ', tente usar pelo menos ' + (CONN_TARGET[w.level] || 3) + '.'),
      check(r.s.variety >= 0.7, 'Variedade de vocabulário: ' + Math.round(r.ttr * 100) + '% de palavras diferentes.' + (r.s.variety < 0.7 ? ' Evite repetir as mesmas palavras.' : '')),
      check(!r.fixes.length, r.fixes.length ? 'Possíveis ajustes (erros comuns de quem fala português):' : 'Nenhum dos erros comuns de brasileiros foi encontrado.')),
    ...r.fixes.slice(0, 8).map(f => h('div', { class: 'wfix' }, f.ex ? h('b', null, '“' + f.ex + '” ') : null, f.msg)),
    h('h3', null, 'Compare com o texto-modelo'),
    h('p', { class: 'small muted' }, 'Leia o modelo e procure 2 ou 3 expressões que você não usou. Depois reescreva seu texto incluindo-as. Esse "notar a diferença" é um dos jeitos mais eficientes de evoluir na escrita.'),
    highlightChunks(w.model, w.use),
    TTS.ok ? h('button', { class: 'btn ghost', onclick: () => speak(w.model) }, icon('speaker'), 'Ouvir o modelo') : null,
    h('h3', null, 'Seu texto'), h('div', { class: 'model-text', lang: LANG.code }, text));
  stageFoot(h('button', { class: 'btn ghost', onclick: () => openWriting(w, text) }, 'Reescrever'), h('button', { class: 'btn big', onclick: () => closeStage() }, 'Concluir'));
}

/* ---------- sounds (minimal pairs, HVPT) ---------- */
function pairStat(p, ok) {
  const st = S.pairs[p.contrast] || (S.pairs[p.contrast] = { n: 0, ok: 0, recent: [] });
  st.n++; if (ok) st.ok++;
  st.recent = (st.recent || []).concat(ok ? 1 : 0).slice(-20);
}
function pairAcc(id) { const st = S.pairs[id]; if (!st || !st.recent || !st.recent.length) return null; return st.recent.reduce((a, b) => a + b, 0) / st.recent.length; }
function voicePool() { const v = TTS.list.filter(x => voiceScore(x) > -10); return v.length ? v : [null]; }
function startPairs(contrasts) {
  if (!TTS.ok) { toast('Este navegador não tem voz em ' + LANG.name + ' para o treino de sons.', 'err'); return; }
  const pool = [];
  (contrasts || []).forEach(c => (c && c.pairs || []).forEach(pr => pool.push({ c, pr })));
  if (!pool.length) { toast('Nenhum par de sons disponível.', 'err'); return; }
  const vp = voicePool();
  const items = [];
  for (let k = 0; k < 12; k++) {
    const { c, pr } = pick(pool);
    const target = pick(pr);
    items.push({ type: 'pair', p: { id: 'pair:' + c.id + ':' + k, en: target, pt: '', a: pr[0], b: pr[1], target, contrast: c.id, tip: c.tip, voice: pick(vp), rate: pick([0.85, 0.95, 1.05]) } });
  }
  startLesson(items, { mode: 'pairs', title: 'Sons do ' + LANG.name });
}
async function playPairBoth(p) { await speakP(p.a, { voiceObj: p.voice, rate: 0.9 }); await wait(350); await speakP(p.b, { voiceObj: p.voice, rate: 0.9 }); }
function exPair(it, inner) {
  const p = it.p;
  const big = h('button', { class: 'big-speaker', 'aria-label': 'Ouvir de novo' }, icon('speaker'));
  const play = () => { big.classList.add('playing'); speak(p.target, { voiceObj: p.voice, rate: p.rate, onend: () => big.classList.remove('playing') }); };
  big.addEventListener('click', play);
  const opts = shuffle([p.a, p.b]);
  const box = h('div', { class: 'pair-opts' });
  const btns = opts.map((o, i) => { const b = h('button', { class: 'opt', lang: LANG.code }, o); b.addEventListener('click', () => choose(i)); put(box, b); return b; });
  function choose(i) {
    if (L.phase !== 'answer') return;
    const ok = opts[i] === p.target;
    btns.forEach((b, j) => { b.disabled = true; if (opts[j] === p.target) b.classList.add('right'); });
    if (!ok) btns[i].classList.add('wrong');
    answer(ok, {});
  }
  put(inner, ...head('Qual palavra você ouviu?', 'Vozes e velocidades mudam de propósito: é assim que o ouvido aprende a categoria do som.'), h('div', { class: 'speaker-row' }, big), box);
  L.ex = { keys: k => { const n = +k; if (n >= 1 && n <= 2) choose(n - 1); }, audio: play };
  foot(h('p', { class: 'small muted' }, 'Toque no alto-falante para ouvir de novo.'));
  play();
}
function viewSounds() {
  const page = h('div', { class: 'page' });
  put(page, subHead('Sons do ' + LANG.name, 'Treino de percepção com pares mínimos, focado nos sons que mais confundem brasileiros. Ouvir várias vozes diferentes acelera o aprendizado dos sons (treino de alta variabilidade, HVPT).'));
  const weakest = PAIRS.slice().sort((a, b) => (pairAcc(a.id) == null ? 0.5 : pairAcc(a.id)) - (pairAcc(b.id) == null ? 0.5 : pairAcc(b.id))).slice(0, 3);
  put(page, h('button', { class: 'btn big block', onclick: () => startPairs(weakest) }, icon('wave'), 'Rodada mista (sons mais difíceis para você)'));
  if (TTS.ok && TTS.list.length < 2) put(page, h('div', { class: 'tip' }, icon('ear'), h('span', null, 'Só uma voz em ' + LANG.name + ' foi encontrada. Instale mais vozes (EUA, Reino Unido, Austrália) no sistema para um treino ainda melhor.')));
  const list = h('div', { class: 'tlist' });
  PAIRS.forEach(c => {
    const acc = pairAcc(c.id);
    const b = h('button', { class: 'contrast' }, h('div', null, h('b', null, c.name), h('div', { class: 'sym' }, c.sym + ' · ' + c.pairs.length + ' pares')),
      h('span', { class: 'small ' + (acc == null ? 'muted' : '') }, acc == null ? 'Novo' : Math.round(acc * 100) + '%'),
      h('div', { class: 'bar mint' }, h('span', { style: { width: Math.round((acc || 0) * 100) + '%' } })));
    b.addEventListener('click', () => {
      openModal([h('h2', null, c.name), h('p', { class: 'pill' }, c.sym), h('p', null, c.tip),
        h('div', { class: 'chips' }, ...c.pairs.map(pr => { const x = h('button', { class: 'wchip' }, pr[0] + ' × ' + pr[1]); x.addEventListener('click', async () => { await speakP(pr[0]); await wait(300); speak(pr[1]); }); return x; })),
        h('div', { class: 'acts' }, h('button', { class: 'btn big block', onclick: () => { closeModal(); startPairs([c]); } }, 'Treinar este som'), h('button', { class: 'btn ghost block', onclick: closeModal }, 'Fechar'))]);
    });
    put(list, b);
  });
  put(page, list);
  return page;
}

/* ---------- lightning challenge ---------- */
function openLightning() {
  let pool = learnedList();
  if (pool.length < 12) pool = ALL.filter(p => p.level === S.startLevel).slice(0, 80);
  if (pool.length < 6) pool = ALL.slice(0, 80);
  const inner = openStage('Desafio relâmpago', h('span', { class: 'coins' }, icon('trophy'), S.light.best || 0));
  put(inner, h('div', { class: 'celebrate', style: { paddingTop: '8px' } }, icon('bolt', 'ic big-ic'), h('h2', null, '60 segundos'),
    h('p', { class: 'muted' }, 'Escolha o significado o mais rápido que puder. A cada 5 acertos seguidos, os pontos aumentam. Errar tira 3 segundos.'),
    h('p', null, 'Seu recorde: ', h('b', null, S.light.best || 0), ' pontos'),
    h('p', { class: 'small muted' }, 'Reconhecer frases em velocidade cria automaticidade, o que libera atenção para entender o resto da conversa.')));
  stageFoot(h('button', { class: 'btn big', id: 'ltStart', onclick: () => run() }, 'Começar'));
  function run() {
    const box = openStage('Desafio relâmpago', h('span', { class: 'coins' }, icon('trophy'), S.light.best || 0));
    ST.dirty = true;
    let score = 0, combo = 0, left = 60, cur = null, over = false;
    const timer = h('div', { class: 'lt-timer' }, h('i', { style: { width: '100%' } }));
    const sc = h('div', { class: 'lt-score', 'aria-live': 'polite' }, '0');
    const mult = h('div', { class: 'lt-mult' });
    const q = h('div', { class: 'lt-q' });
    const opts = h('div', { class: 'options' });
    put(box, h('div', { class: 'lt-top' }, timer, sc), mult, q, opts);
    stageFoot(h('p', { class: 'small muted' }, 'Teclas 1 a 3 também funcionam.'));
    const t0 = Date.now(); let penalty = 0;
    const iv = setInterval(() => {
      left = Math.max(0, 60 - (Date.now() - t0) / 1000 - penalty);
      timer.firstChild.style.width = (left / 60 * 100) + '%';
      if (left <= 0) end();
    }, 200);
    ST.cleanup = () => { clearInterval(iv); over = true; document.removeEventListener('keydown', onKey); };
    function onKey(e) { if (over || !stageOpen()) return; const k = +e.key; if (k >= 1 && k <= 3 && cur) { e.preventDefault(); cur(k - 1); } }
    document.addEventListener('keydown', onKey);
    function next() {
      if (over) return;
      const p = pick(pool);
      const enToPt = Math.random() < 0.7;
      const right = enToPt ? p.pt : p.en;
      const list = shuffle([right, ...distractors(p, enToPt ? 'pt' : 'en', 2)]);
      kids(q, h('span', { lang: enToPt ? LANG.code : 'pt-BR' }, enToPt ? p.en : p.pt));
      const btns = list.map((o, i) => h('button', { class: 'opt' + (enToPt ? '' : ' en-opt') }, h('kbd', null, String(i + 1)), h('span', null, o)));
      btns.forEach((b, i) => b.addEventListener('click', () => cur && cur(i)));
      kids(opts, ...btns);
      cur = i => {
        if (over) return; cur = null;
        if (list[i] === right) { combo++; const m = 1 + Math.floor(combo / 5); score += m; SFX.ok(combo); buzz(8); box.classList.remove('flash-ok'); void box.offsetWidth; box.classList.add('flash-ok'); }
        else { combo = 0; penalty += 3; SFX.bad(); buzz([20, 30, 20]); box.classList.remove('flash-bad'); void box.offsetWidth; box.classList.add('flash-bad'); }
        sc.textContent = score;
        mult.textContent = combo >= 5 ? '×' + (1 + Math.floor(combo / 5)) + ' combo ' + combo : '';
        next();
      };
    }
    function end() {
      if (over) return;
      over = true; clearInterval(iv); document.removeEventListener('keydown', onKey); ST.dirty = false; cur = null;
      const rec = score > (S.light.best || 0);
      if (rec) S.light.best = score;
      S.light.plays = (S.light.plays || 0) + 1; S.stats.lightning = (S.stats.lightning || 0) + 1;
      const g = score ? addXP(score * 4) : 0; const c = addCoins(Math.floor(score / 3) + (rec ? 10 : 0));
      questEvent('light', score, true); if (score) touchStreakSoft(); save(); checkAch();
      SFX.done(); if (rec && score) confetti(160);
      const res = openStage('Desafio relâmpago', h('span', { class: 'coins' }, icon('trophy'), S.light.best));
      put(res, h('div', { class: 'celebrate' }, icon(rec ? 'trophy' : 'bolt', 'ic big-ic'), h('div', { class: 'big-num' }, score), h('h2', null, rec && score ? 'Novo recorde!' : 'pontos'),
        h('p', { class: 'muted' }, rec && score ? 'Você superou sua melhor marca.' : 'Recorde: ' + S.light.best + '. Quanto mais frases você aprende, mais rápido fica.'),
        h('div', { class: 'coins' }, '+' + g + ' XP · ', icon('coin'), '+' + c)));
      stageFoot(h('button', { class: 'btn ghost', onclick: () => closeStage() }, 'Sair'), h('button', { class: 'btn big', id: 'ltAgain', onclick: () => run() }, 'Jogar de novo'));
    }
    next();
  }
}
