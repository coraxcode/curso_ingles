/* =========================================================
   Engagement: quests, coins, shop, gifts, adaptivity, sharing
   ========================================================= */
function adapt(it) {
  if (!L || it.type === 'intro' || it.retry || it.adapted || ['pair', 'mcq'].includes(it.type)) return;
  if (L.mode === 'gym' || L.mode === 'pairs' || L.mode === 'text') return;
  const hst = L.hist.slice(-6);
  if (hst.length < 4) return;
  const acc = hst.reduce((a, b) => a + b, 0) / hst.length;
  // keep accuracy near the ~85% "sweet spot" (Wilson et al., 2019)
  if (acc < 0.67 && PRODUCTIVE.has(it.type)) {
    const e = easier(it.type, it.p);
    if (e !== it.type) { it.type = e; it.adapted = 'easy'; }
  } else if (acc === 1 && L.combo >= 6 && S.cards[it.p.id] && !PRODUCTIVE.has(it.type)) {
    const hard = ['translate', 'dictation', 'cloze'].filter(t => eligible(t, it.p));
    if (hard.length) { it.type = pick(hard); it.adapted = 'hard'; it.challenge = true; }
  }
}

const QUESTS = {
  xp: { t: g => 'Ganhe ' + fmt(g) + ' XP', ev: 'xp', coins: 20, core: true, icon: 'bolt', goal: () => Math.max(100, Math.round(S.prefs.goal * 0.8 / 10) * 10) },
  lessons: { t: g => 'Conclua ' + g + ' lições da trilha', ev: 'lesson', coins: 20, core: true, icon: 'path', goal: () => 2 },
  combo: { t: g => 'Acerte ' + g + ' seguidas', ev: 'combo', max: true, coins: 15, icon: 'flame', goal: () => pick([8, 10, 12]) },
  review: { t: g => 'Revise ' + g + ' frases', ev: 'review', coins: 15, icon: 'review', goal: () => 10, need: () => learnedList().length >= 10 },
  perfect: { t: () => 'Termine uma lição sem errar', ev: 'perfect', coins: 20, icon: 'star', goal: () => 1 },
  gym: { t: () => 'Faça um treino de escuta', ev: 'gym', coins: 15, icon: 'ear', goal: () => 1, need: () => learnedList().length >= 5 && TTS.ok },
  text: { t: () => 'Complete uma história ou áudio', ev: 'text', coins: 25, icon: 'text', goal: () => 1, need: () => TEXTS.length > 0 },
  rp: { t: () => 'Pratique uma conversa', ev: 'rp', coins: 25, icon: 'chat', goal: () => 1, need: () => TEXTS.some(t => t.type === 'dialogue') },
  write: { t: () => 'Escreva um texto guiado', ev: 'write', coins: 30, icon: 'pen', goal: () => 1, need: () => WRITING.length > 0 },
  pairs: { t: () => 'Faça uma rodada de sons', ev: 'pairs', coins: 15, icon: 'wave', goal: () => 1, need: () => TTS.ok && PAIRS.length > 0 },
  light: { t: g => 'Faça ' + g + ' pontos no Desafio relâmpago', ev: 'light', max: true, coins: 20, icon: 'bolt', goal: () => pick([8, 12, 15]) },
  imm: { t: g => 'Registre ' + g + ' min de ' + LANG.name + ' real', ev: 'imm', coins: 20, icon: 'tv', goal: () => 15 }
};
function seeded(seed) { let x = 7; for (const c of String(seed)) x = (Math.imul(x, 31) + c.charCodeAt(0)) >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
function weekKey(t = Date.now()) { const d = new Date(t); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dayKey(d.getTime()); }
function ensureQuests() {
  const q = S.quests, t = today();
  const valid = Array.isArray(q.list) && q.list.length && q.list.every(x => x && QUESTS[x.id] && x.goal > 0);
  if (q.day !== t || !valid) {
    const r = seeded(t);
    const ids = Object.keys(QUESTS);
    const core = ids.filter(i => QUESTS[i].core);
    const rest = ids.filter(i => !QUESTS[i].core && (!QUESTS[i].need || QUESTS[i].need()));
    const chosen = [core[Math.floor(r() * core.length)]];
    while (chosen.length < 3 && rest.length) chosen.push(rest.splice(Math.floor(r() * rest.length), 1)[0]);
    q.day = t; q.bonus = false;
    q.list = chosen.map(id => ({ id, goal: QUESTS[id].goal(), prog: 0, done: false, claimed: false }));
  }
  const w = weekKey();
  if (q.week !== w || !Array.isArray(q.wlist) || !q.wlist.every(x => x && WQ[x.id] && x.goal > 0)) {
    q.week = w;
    q.wlist = [{ id: 'wxp', goal: S.prefs.goal * 5, prog: 0, done: false, claimed: false }, { id: 'wdays', goal: 5, prog: 0, done: false, claimed: false, days: [] }];
  }
}
const WQ = { wxp: { t: g => 'Ganhe ' + fmt(g) + ' XP nesta semana', coins: 100 }, wdays: { t: g => 'Estude em ' + g + ' dias diferentes nesta semana', coins: 100 } };
let questToasts = [];
function questEvent(ev, n = 1, isMax = false) {
  if (!S) return;
  ensureQuests();
  const q = S.quests;
  for (const it of q.list) {
    const def = QUESTS[it.id]; if (!def || def.ev !== ev || it.done) continue;
    it.prog = def.max ? Math.max(it.prog, n) : it.prog + n;
    if (it.prog >= it.goal) { it.prog = it.goal; it.done = true; S.stats.quests = (S.stats.quests || 0) + 1; questToasts.push(def.t(it.goal)); }
  }
  if (ev === 'xp') for (const it of q.wlist) {
    if (it.done) continue;
    if (it.id === 'wxp') it.prog += n;
    if (it.id === 'wdays') { if (!Array.isArray(it.days)) it.days = []; if (!it.days.includes(today())) it.days.push(today()); it.prog = it.days.length; }
    if (it.prog >= it.goal) { it.prog = it.goal; it.done = true; questToasts.push(WQ[it.id].t(it.goal)); }
  }
  flushQuestToasts();
}
function flushQuestToasts() {
  if (!questToasts.length) return;
  const list = questToasts; questToasts = [];
  list.forEach((t, i) => setTimeout(() => { toast('Missão cumprida: ' + t, 'ach', 'flag'); SFX.chest(); }, 250 + i * 500));
  renderTop();
}
function claimable() { ensureQuests(); return S.quests.list.filter(x => x.done && !x.claimed).length + S.quests.wlist.filter(x => x.done && !x.claimed).length + (S.quests.list.every(x => x.claimed) && !S.quests.bonus ? 1 : 0); }
function claimQuest(it, weekly) {
  if (!it.done || it.claimed) return;
  it.claimed = true;
  const c = addCoins(weekly ? WQ[it.id].coins : QUESTS[it.id].coins);
  const g = addXP(weekly ? 50 : 15);
  SFX.chest(); buzz([20, 40, 20]);
  toast('+' + c + ' moedas e +' + g + ' XP', 'ach', 'coin');
  save(); render();
}
function openQuestChest() {
  ensureQuests();
  const q = S.quests;
  if (q.bonus || !q.list.every(x => x.claimed)) return;
  q.bonus = true;
  const r = Math.random(); let msg;
  if (r < 0.15 && S.streak.freezes < 3) { S.streak.freezes++; msg = 'Protetor de sequência + 20 moedas'; addCoins(20); }
  else if (r < 0.3) { S.boostUntil = Date.now() + 15 * 60e3; msg = 'XP em dobro por 15 minutos + 20 moedas'; addCoins(20); }
  else { const c = addCoins(30 + Math.floor(Math.random() * 51)); msg = '+' + c + ' moedas'; }
  SFX.done(); confetti(140); buzz([30, 50, 30, 50, 60]);
  save();
  openModal([h('div', { class: 'celebrate' }, icon('chest', 'ic big-ic'), h('h2', null, 'Baú das missões'), h('p', { class: 'reward' }, msg), h('p', { class: 'muted small' }, 'Volte amanhã: as missões mudam todo dia.')),
    h('div', { class: 'acts' }, h('button', { class: 'btn big gold block', onclick: () => { closeModal(); render(); } }, 'Coletar'))]);
}

const SHOP = [
  { id: 'freeze', t: 'Protetor de sequência', d: 'Salva sua sequência em um dia sem estudo (máx. 3).', price: 100, can: () => S.streak.freezes < 3, buy: () => { S.streak.freezes++; } },
  { id: 'boost', t: 'XP em dobro', d: 'Todo XP vale o dobro por 15 minutos.', price: 80, can: () => Date.now() > S.boostUntil, buy: () => { S.boostUntil = Date.now() + 15 * 60e3; } },
  { id: 'acc-ocean', t: 'Tema Oceano', d: 'Cor de destaque azul-turquesa.', price: 300, accent: 'ocean', color: '#0B8796' },
  { id: 'acc-sunset', t: 'Tema Pôr do sol', d: 'Cor de destaque laranja.', price: 300, accent: 'sunset', color: '#D9480F' },
  { id: 'acc-forest', t: 'Tema Floresta', d: 'Cor de destaque verde.', price: 300, accent: 'forest', color: '#2B8A3E' },
  { id: 'acc-grape', t: 'Tema Uva', d: 'Cor de destaque roxa.', price: 300, accent: 'grape', color: '#7B3FE4' }
];
function applyAccent() {
  const a = S.shop.accent;
  if (!a || a === 'default') document.documentElement.removeAttribute('data-accent'); else document.documentElement.setAttribute('data-accent', a);
}
function buyItem(it) {
  if (it.accent && S.shop.owned.includes(it.id)) { S.shop.accent = it.accent; applyAccent(); save(); render(); toast('Tema aplicado.'); return; }
  if (S.coins < it.price) { toast('Faltam ' + (it.price - S.coins) + ' moedas. Complete missões para ganhar mais.', 'err'); return; }
  if (it.can && !it.can()) { toast('Você já tem o máximo deste item agora.'); return; }
  S.coins -= it.price;
  if (it.accent) { S.shop.owned.push(it.id); S.shop.accent = it.accent; applyAccent(); }
  else it.buy();
  SFX.chest(); buzz(20); save(); render();
  toast(it.t + ' adquirido!', 'ach', 'coin');
}

function weekXP(offsetWeeks = 0) {
  const start = weekKey(); let sum = 0;
  for (let i = 0; i < 7; i++) sum += S.xpDay[keyAdd(start, i - 7 * offsetWeeks)] || 0;
  return sum;
}
function shareText() {
  const v = vocab();
  return 'Estou aprendendo ' + LANG.name + ' com o Fluent: ' + displayStreak() + ' dias seguidos, ' + fmt(learnedList().length) + ' frases aprendidas e ' + fmt(v.count) + ' palavras-chave do ' + LANG.name + '. Bora?';
}
async function shareProgress() {
  const text = shareText();
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Texto copiado. Cole onde quiser compartilhar.'); }
  catch { openModal([h('h2', null, 'Compartilhar progresso'), h('p', { class: 'muted small' }, 'Copie o texto abaixo:'), h('p', { class: 'model-text' }, text), h('div', { class: 'acts' }, h('button', { class: 'btn block', onclick: closeModal }, 'Fechar'))]); }
}
function giftCard() {
  if (S.gift === today() || !S.onboarded) return null;
  const card = h('button', { class: 'gift', style: { width: '100%', textAlign: 'left', border: '0' }, 'aria-label': 'Abrir presente diário' }, icon('gift'),
    h('div', null, h('b', null, 'Presente do dia'), h('div', { class: 'small' }, 'Toque para abrir. Cada dia traz uma surpresa diferente.')));
  card.addEventListener('click', () => {
    if (S.gift === today()) return;
    S.gift = today();
    const r = Math.random();
    const c = addCoins(r < 0.6 ? 5 + Math.floor(Math.random() * 11) : r < 0.92 ? 15 + Math.floor(Math.random() * 16) : 50);
    SFX.chest(); buzz([20, 30, 20]); if (!reduceMotion()) confetti(60);
    save();
    kids(card, icon('coin'), h('div', null, h('b', null, '+' + c + ' moedas!'), h('div', { class: 'small' }, 'Volte amanhã para outro presente.')));
    renderTop();
  });
  return card;
}

/* =========================================================
   Stage overlay (reader, conversation, writing, lightning)
   ========================================================= */
const ST = { open: false, pushed: false, dirty: false, onClose: null, cleanup: null };
function openStage(title, extra) {
  stopRadio(); stopSpeak();
  if (ST.cleanup) { try { ST.cleanup(); } catch {} }
  ST.dirty = false; ST.onClose = null; ST.cleanup = null;
  $('#stageTitle').textContent = title;
  kids($('#stageExtra'), extra || null);
  kids($('#stageInner')); kids($('#stageFoot'));
  try { document.activeElement && document.activeElement.blur(); } catch {}
  $('#stage').hidden = false; document.body.style.overflow = 'hidden'; document.body.classList.add('in-lesson');
  if (!ST.open) { try { history.pushState({ fl: 2 }, ''); ST.pushed = true; } catch { ST.pushed = false; } }
  ST.open = true;
  $('#stageBody').scrollTop = 0;
  return $('#stageInner');
}
function stageFoot(...btns) { kids($('#stageFoot'), h('div', { class: 'l-foot-in' }, ...btns)); }
const stageOpen = () => !$('#stage').hidden;
function closeStage(opts = {}) {
  if (!ST.open) return;
  stopSpeak(); stopRec(); if (recState) recState.stop();
  if (ST.cleanup) { try { ST.cleanup(); } catch {} ST.cleanup = null; }
  $('#stage').hidden = true; document.body.style.overflow = ''; document.body.classList.remove('in-lesson');
  ST.open = false;
  const pushed = ST.pushed; ST.pushed = false;
  if (pushed && !opts.fromPop && !opts.keepHistory) { ignorePop = true; try { history.back(); } catch { ignorePop = false; } }
  if (!opts.silent) render();
}
async function askCloseStage() {
  if (ST.dirty) {
    const ok = await confirmBox('Sair desta atividade?', 'O progresso desta atividade será perdido.', 'Sair', true);
    if (!ok) return;
  }
  closeStage();
}
