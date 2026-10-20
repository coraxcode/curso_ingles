(() => {
'use strict';

/* =========================================================
   Utilities
   ========================================================= */
// small polyfill for browsers from before 2021 (Safari 13, older Android WebViews)
if (typeof Element !== 'undefined' && !Element.prototype.replaceChildren) {
  Element.prototype.replaceChildren = function (...nodes) { while (this.firstChild) this.removeChild(this.firstChild); this.append(...nodes); };
}
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
function kids(el, ...k) { el.replaceChildren(); return put(el, ...k); }
function put(el, ...kids) { for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c); return el; }
const SVGNS = 'http://www.w3.org/2000/svg';
function icon(id, cls = 'ic') {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVGNS, 'use'); u.setAttribute('href', '#i-' + id);
  put(s, u); return s;
}
const fmt = n => Math.round(Number(n) || 0).toLocaleString('pt-BR');
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const DAY = 864e5;
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function dayKey(t = Date.now()) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function keyAdd(key, n) { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n, 12)); }
function keyDiff(a, b) { const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY); }
function dayStart(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function dueIn(days) { const d = new Date(dayStart()); d.setDate(d.getDate() + days); return d.getTime(); }
const tomorrow = () => dueIn(1);
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/* =========================================================
   Course data
   ========================================================= */
// The app is language-agnostic: a "course pack" (JSON) describes one target language. The built-in pack is
// American English; other packs (French, Latin, ...) can be loaded from Perfil › Idiomas. Internally every
// phrase keeps the target-language text in the field `en` (historical name) and the Portuguese text in `pt`.
let EMBEDDED;
try { EMBEDDED = JSON.parse($('#course-data').textContent); } catch (e) { EMBEDDED = { phrases: [] }; }
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_NAME = { A1: 'Iniciante', A2: 'Básico', B1: 'Intermediário', B2: 'Intermediário superior', C1: 'Avançado', C2: 'Proficiente' };
let COURSE = null, RAW = null, TEXTS = [], WRITING = [], PAIRS = [], CANDO = {}, LEX = { lemmas: [], mass: [] }, LIDX = new Map();
const UNIT_SIZE = 5, PART_SIZE = 10;

/* ---- language profiles: what the app knows about a language beyond the pack itself ---- */
const LANG_NAMES = { en: ['inglês', 'Inglês'], fr: ['francês', 'Francês'], la: ['latim', 'Latim'], es: ['espanhol', 'Espanhol'], it: ['italiano', 'Italiano'], de: ['alemão', 'Alemão'], pt: ['português', 'Português'], ja: ['japonês', 'Japonês'], zh: ['chinês', 'Chinês'], ko: ['coreano', 'Coreano'], ru: ['russo', 'Russo'], nl: ['holandês', 'Holandês'], sv: ['sueco', 'Sueco'], el: ['grego', 'Grego'], ar: ['árabe', 'Árabe'], tr: ['turco', 'Turco'], pl: ['polonês', 'Polonês'] };
const PROFILES = {
  en: {
    numw: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
    stop: 'a an the to of in on at for and or but is are was were be been am i you he she it we they my your his her our their this that these those me him us them do does did not no yes so as if by with from up out',
    voices: { good: /natural|neural|premium|enhanced|online|google us english|samantha|aria|jenny|ava|allison|guy|zoe|evan|nathan|michelle|christopher/, bad: /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|wobble|zarvox|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/ },
    region: 'americano'
  },
  fr: {
    numw: ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt'],
    stop: "le la les un une des de du d l à au aux et ou mais est sont je tu il elle on nous vous ils elles me te se ne pas que qui ce c en y",
    voices: { good: /natural|neural|premium|enhanced|online|google français|thomas|amelie|amélie|audrey|aurelie|aurélie|denise|henri|celine|céline/, bad: /eddy|flo|reed|rocko|sandy|shelley|grandma|grandpa|jacques/ },
    region: 'da França'
  },
  la: { numw: ['nihil', 'unus', 'duo', 'tres', 'quattuor', 'quinque', 'sex', 'septem', 'octo', 'novem', 'decem'], stop: 'et in est sed non ad cum ut ex de a ab qui quae quod', voices: { good: /natural|neural|premium|enhanced/, bad: /eddy|flo|reed|rocko|sandy|shelley/ }, region: 'clássico' },
  es: { numw: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'], stop: 'el la los las un una unos unas de del a al y o pero es son yo tú él ella nosotros ellos me te se no que en', voices: { good: /natural|neural|premium|enhanced|online|google español|monica|mónica|paulina|jorge|diego/, bad: /eddy|flo|reed|rocko|sandy|shelley/ }, region: '' },
  it: { numw: ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'], stop: 'il lo la i gli le un uno una di da a in con su per e o ma è sono io tu lui lei noi loro mi ti si non che', voices: { good: /natural|neural|premium|enhanced|online|google italiano|alice|luca|federica/, bad: /eddy|flo|reed|rocko|sandy|shelley/ }, region: '' },
  de: { numw: ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'], stop: 'der die das ein eine und oder aber ist sind ich du er sie es wir ihr nicht zu in an auf mit von', voices: { good: /natural|neural|premium|enhanced|online|google deutsch|anna|markus|petra/, bad: /eddy|flo|reed|rocko|sandy|shelley/ }, region: '' }
};
// English-only answer normalisation (contractions) and the English listening/writing helpers live in LANG.
const CONTR_EN = [
  [/\bi'm\b/g, 'i am'], [/\b(you|we|they)'re\b/g, '$1 are'], [/\b(he|she|it|that|there|what|who|where|here|how|when|why)'s\b/g, '$1 is'],
  [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bwon't\b/g, 'will not'], [/\bshan't\b/g, 'shall not'], [/\bain't\b/g, 'am not'],
  [/\b(\w+)n't\b/g, '$1 not'], [/\b(\w+)'ve\b/g, '$1 have'], [/\b(\w+)'ll\b/g, '$1 will'], [/\b(\w+)'d\b/g, '$1 would'], [/\blet's\b/g, 'let us'],
  [/\bgonna\b/g, 'going to'], [/\bwanna\b/g, 'want to'], [/\bgotta\b/g, 'got to'], [/\bok\b/g, 'okay'], [/\bo\.k\.?/g, 'okay'],
  [/\bmr\b/g, 'mister'], [/\bmrs\b/g, 'missus'], [/\bdr\b/g, 'doctor'], [/\btv\b/g, 'television'], [/\be-?mail\b/g, 'email']
];
let LANG = null;
const langShort = code => String(code || '').toLowerCase().split(/[-_]/)[0];
const LANG_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i;
const ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;
function hashStr(s) { let x = 2166136261; for (const c of String(s)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return x.toString(36); }
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const strList = (v, max, each = 200) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).slice(0, max).map(x => x.trim().slice(0, each)) : [];
/** Validates and normalises a course pack of any language into the internal shape. Throws on malformed input. */
function normalizePack(raw, builtin = false) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('o arquivo não é um objeto JSON');
  if (!Array.isArray(raw.phrases)) throw Error('o pacote precisa ter uma lista "phrases"');
  if (raw.phrases.length > 20000) throw Error('máximo de 20 mil frases por pacote');
  const code = LANG_RE.test(String(raw.language || '')) ? String(raw.language) : (builtin ? 'en-US' : null);
  if (!code) throw Error('campo "language" ausente ou inválido (ex.: "fr-FR")');
  const short = langShort(code);
  if (short === 'pt' && langShort(raw.translationLanguage || 'pt-BR') === 'pt') throw Error('a língua do curso não pode ser a mesma da tradução');
  const key = /^[a-z]{2,3}$/i.test(String(raw.targetKey || '')) ? String(raw.targetKey) : short;
  const pick1 = o => { for (const k of [key, short, 'en', 'target', 'text', 't']) if (typeof o[k] === 'string') return o[k]; return ''; };
  const id = builtin ? 'en' : (ID_RE.test(String(raw.id || '')) ? String(raw.id).toLowerCase() : short + '-' + hashStr((raw.title || '') + raw.phrases.length + pick1(raw.phrases[0] || {})));
  const names = LANG_NAMES[short] || [short, short.toUpperCase()];
  const seen = new Set();
  const phrases = [];
  raw.phrases.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const en = str(pick1(p), 350), pt = str(p.pt, 500);
    if (en.length < 2 || !pt) return;
    let pid = str(p.id, 40); if (!pid || !/^[\w-]+$/.test(pid) || seen.has(pid)) pid = 'P' + (i + 1);
    seen.add(pid);
    const o = { id: pid, en, pt, level: LEVELS.includes(p.level) ? p.level : 'B1', topic: str(p.topic, 90) || 'Geral', focus: str(p.focus, 100), note: str(p.note, 700) };
    if (p.sound) o.sound = str(p.sound, 200);
    if (Array.isArray(p.w) && p.w.every(x => Number.isInteger(x) && x >= 0)) o.w = p.w;
    phrases.push(o);
  });
  if (!phrases.length) throw Error('nenhuma frase válida encontrada');
  const texts = (Array.isArray(raw.texts) ? raw.texts : []).slice(0, 500).map((t, i) => {
    if (!t || typeof t !== 'object' || !Array.isArray(t.lines) || !t.lines.length) return null;
    const lines = t.lines.slice(0, 80).map(l => l && typeof l === 'object' ? { s: ['A', 'B', 'N'].includes(l.s) ? l.s : 'N', en: str(pick1(l), 400), pt: str(l.pt, 500), alt: strList(l.alt, 6, 300) } : null).filter(l => l && l.en);
    const q = (Array.isArray(t.q) ? t.q : []).slice(0, 12).map(x => x && typeof x === 'object' && typeof x.q === 'string' && typeof x.a === 'string' && Array.isArray(x.o) ? { q: str(x.q, 300), a: str(x.a, 200), o: strList(x.o, 6) } : null).filter(x => x && x.o.length >= 2 && x.o.includes(x.a));
    if (!lines.length) return null;
    return { id: str(t.id, 40) || 't' + (i + 1), level: LEVELS.includes(t.level) ? t.level : 'B1', type: ['dialogue', 'story', 'news', 'podcast', 'essay'].includes(t.type) ? t.type : 'story', topic: str(t.topic, 90), title: str(t.title, 120) || 'Texto ' + (i + 1), lines, q, w: Array.isArray(t.w) ? t.w.filter(Number.isInteger) : undefined };
  }).filter(Boolean);
  const writing = (Array.isArray(raw.writing) ? raw.writing : []).slice(0, 200).map((w, i) => w && typeof w === 'object' && typeof w.task === 'string' && typeof w.model === 'string' ? { id: str(w.id, 40) || 'w' + (i + 1), level: LEVELS.includes(w.level) ? w.level : 'B1', title: str(w.title, 120) || 'Redação ' + (i + 1), task: str(w.task, 1200), min: clamp(Math.round(+w.min) || 40, 10, 600), use: strList(w.use, 8, 80), model: str(w.model, 4000) } : null).filter(Boolean);
  const pairs = (Array.isArray(raw.pairs) ? raw.pairs : []).slice(0, 60).map((c, i) => c && typeof c === 'object' && Array.isArray(c.pairs) ? { id: str(c.id, 40) || 'c' + (i + 1), name: str(c.name, 80) || 'Contraste ' + (i + 1), sym: str(c.sym, 60), tip: str(c.tip, 600), pairs: c.pairs.filter(pr => Array.isArray(pr) && pr.length === 2 && pr.every(x => typeof x === 'string' && x.trim())).slice(0, 40).map(pr => [pr[0].trim().slice(0, 60), pr[1].trim().slice(0, 60)]) } : null).filter(c => c && c.pairs.length);
  const cando = {};
  if (raw.cando && typeof raw.cando === 'object') for (const L of LEVELS) if (Array.isArray(raw.cando[L])) cando[L] = strList(raw.cando[L], 12, 300);
  let lexicon = null;
  if (raw.lexicon && Array.isArray(raw.lexicon.lemmas) && Array.isArray(raw.lexicon.mass) && raw.lexicon.lemmas.length === raw.lexicon.mass.length && raw.lexicon.lemmas.length <= 20000) {
    lexicon = { lemmas: raw.lexicon.lemmas.map(l => String(l).slice(0, 40)), mass: raw.lexicon.mass.map(m => (typeof m === 'number' && isFinite(m) && m >= 0) ? m : 0) };
  }
  const prof = PROFILES[short] || {};
  const reductions = (Array.isArray(raw.reductions) ? raw.reductions : []).slice(0, 60).map(r => Array.isArray(r) && r.length >= 2 ? [str(r[0], 80), str(r[1], 80), str(r[2] || '', 200)] : null).filter(r => r && r[0] && r[1]);
  const immersion = {};
  if (raw.immersionTips && typeof raw.immersionTips === 'object') for (const L of LEVELS) if (Array.isArray(raw.immersionTips[L])) immersion[L] = strList(raw.immersionTips[L], 6, 200);
  return {
    id, builtin, schema: str(raw.schema, 40) || 'fluent-course-v3', title: str(raw.title, 120) || (names[1] + (prof.region ? ' ' + prof.region : '')),
    language: code, short, targetKey: key, name: names[0], Name: names[1], region: prof.region || '', description: str(raw.description, 400),
    phrases, texts, writing, pairs, cando, lexicon,
    reductions: reductions.length ? reductions : null, immersion: Object.keys(immersion).length ? immersion : null,
    connectors: strList(raw.connectors, 120, 40), numw: strList(raw.numbers, 40, 30).length ? strList(raw.numbers, 40, 30) : (prof.numw || []),
    stop: new Set((str(raw.stopwords, 4000) || prof.stop || '').split(/\s+/).filter(Boolean)),
    voices: prof.voices || { good: /natural|neural|premium|enhanced|online/, bad: /eddy|flo|reed|rocko|sandy|shelley|grandma|grandpa/ }
  };
}
/** Makes a (normalised) pack the active course: fills the globals every view reads from. */
function setCourse(pack) {
  COURSE = pack; RAW = pack;
  TEXTS = pack.texts; WRITING = pack.writing; PAIRS = pack.pairs; CANDO = pack.cando;
  LEX = pack.lexicon || { lemmas: [], mass: [] }; LIDX = new Map(LEX.lemmas.map((l, i) => [l, i]));
  LANG = { code: pack.language, short: pack.short, name: pack.name, Name: pack.Name, isEn: pack.short === 'en', contr: pack.short === 'en' ? CONTR_EN : [], numw: pack.numw, stop: pack.stop, voices: pack.voices, connectors: pack.short === 'en' ? CONNECTORS_EN : pack.connectors, l1: pack.short === 'en' ? L1_ERRORS : [], reductions: pack.short === 'en' && !pack.reductions ? REDUCTIONS_EN : (pack.reductions || []), immersion: pack.immersion || (pack.short === 'en' ? IMMERSION_TIPS_EN : null) };
  ACH = buildAch();
  if (TTS.ok) loadVoices();
  bump();
}
const stateKey = id => id === 'en' ? 'fluent.v3' : 'fluent.v3.' + id;

/* ---- course packs stored on the device (IndexedDB, with a localStorage fallback) ---- */
const COURSES_KEY = 'fluent.courses', ACTIVE_KEY = 'fluent.course';
function courseList() { try { const l = JSON.parse(localStorage.getItem(COURSES_KEY) || '[]'); return Array.isArray(l) ? l.filter(c => c && ID_RE.test(String(c.id || ''))) : []; } catch { return []; } }
function saveCourseList(l) { try { localStorage.setItem(COURSES_KEY, JSON.stringify(l)); } catch {} }
function activeCourseId() { try { const id = localStorage.getItem(ACTIVE_KEY); return id && ID_RE.test(id) ? id : 'en'; } catch { return 'en'; } }
function setActiveCourseId(id) { try { localStorage.setItem(ACTIVE_KEY, id); } catch {} }
const PackDB = {
  open() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(Error('sem IndexedDB'));
      let r; try { r = indexedDB.open('fluent-packs', 1); } catch (e) { return rej(e); }
      r.onupgradeneeded = () => { try { r.result.createObjectStore('packs'); } catch {} };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || Error('idb')); r.onblocked = () => rej(Error('idb bloqueado'));
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    try {
      return await new Promise((res, rej) => { const t = db.transaction('packs', mode); const req = fn(t.objectStore('packs')); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error || Error('idb')); t.onabort = () => rej(t.error || Error('idb')); });
    } finally { try { db.close(); } catch {} }
  },
  async get(id) { try { const v = await this.tx('readonly', s => s.get(id)); if (v) return v; } catch {} try { return JSON.parse(localStorage.getItem('fluent.pack.' + id) || 'null'); } catch { return null; } },
  async put(id, obj) { try { await this.tx('readwrite', s => s.put(obj, id)); return 'idb'; } catch {} localStorage.setItem('fluent.pack.' + id, JSON.stringify(obj)); return 'ls'; },
  async del(id) { try { await this.tx('readwrite', s => s.delete(id)); } catch {} try { localStorage.removeItem('fluent.pack.' + id); } catch {} }
};
async function loadPack(id) {
  if (id === 'en') return normalizePack(EMBEDDED, true);
  const raw = await PackDB.get(id);
  if (!raw) throw Error('pacote não encontrado neste aparelho');
  const pack = normalizePack(raw); pack.id = id; return pack;
}
async function importPack(data) {
  const pack = normalizePack(data);
  if (pack.short === langShort(EMBEDDED.language || 'en')) pack.id = 'en-' + hashStr(pack.title + pack.phrases.length);
  const list = courseList();
  const prev = list.find(c => c.id === pack.id);
  if (prev && !(await confirmBox('Substituir o curso "' + prev.name + '"?', 'O progresso desse curso é mantido; só o conteúdo é atualizado.', 'Substituir'))) return null;
  // store the normalised pack (already validated and size-limited), never the raw file
  const stored = { schema: 'fluent-course-v3', id: pack.id, title: pack.title, language: pack.language, translationLanguage: 'pt-BR', targetKey: 'en', phrases: pack.phrases, texts: pack.texts, writing: pack.writing, pairs: pack.pairs, cando: pack.cando, lexicon: pack.lexicon, reductions: pack.reductions, immersionTips: pack.immersion, connectors: pack.connectors, numbers: pack.numw, stopwords: [...pack.stop].join(' ') };
  await PackDB.put(pack.id, stored);
  const meta = { id: pack.id, name: pack.title, lang: pack.language, phrases: pack.phrases.length, texts: pack.texts.length, added: Date.now() };
  saveCourseList(prev ? list.map(c => c.id === pack.id ? meta : c) : list.concat(meta));
  return pack;
}
async function switchCourse(id) {
  if (COURSE && id === COURSE.id) return;
  let pack;
  try { pack = await loadPack(id); } catch (e) { toast('Não foi possível abrir o curso: ' + e.message + '.', 'err'); return; }
  stopRadio(); stopSpeak(); if (lessonOpen()) closeLesson(); if (stageOpen()) closeStage({ silent: true });
  save();
  setActiveCourseId(pack.id);
  setCourse(pack); load(); buildCourse(); ensureQuests(); applyTheme(); applyAccent();
  if (!S.onboarded) { S.onboarded = true; S.startLevel = 'A1'; S.ui.level = 'A1'; save(); }
  SUB = null; go('home');
  toast('Curso ativo: ' + pack.title + '.', 'ach', 'flag');
}
async function removeCourse(id) {
  const meta = courseList().find(c => c.id === id); if (!meta) return;
  if (!(await confirmBox('Remover "' + meta.name + '"?', 'O curso e o progresso dele neste aparelho serão apagados. Faça um backup antes, se quiser guardar.', 'Remover', true))) return;
  if (COURSE && COURSE.id === id) await switchCourse('en');
  await PackDB.del(id);
  try { localStorage.removeItem(stateKey(id)); } catch {}
  saveCourseList(courseList().filter(c => c.id !== id));
  render(); toast('Curso removido.');
}

/* =========================================================
   State
   ========================================================= */
const OLD_KEY = 'fluent.3000.v2';
const KEY = () => stateKey(COURSE ? COURSE.id : 'en');
const DEFAULT = () => ({
  v: 3, created: Date.now(), onboarded: false, startLevel: 'A1', migrated: 0,
  cards: {}, xp: 0, xpDay: {}, newDay: {}, streak: { count: 0, last: null, freezes: 1, best: 0 }, frozenDays: [], boostUntil: 0,
  ach: {}, stats: { answers: 0, correct: 0, lessons: 0, perfect: 0, maxCombo: 0, dictations: 0, speaks: 0, reviews: 0, chests: 0, secs: 0, crit: 0, texts: 0, rp: 0, writings: 0, pairRounds: 0, lightning: 0, quests: 0, coinsEarned: 0 },
  imm: {}, extra: [], coins: 0, quests: {}, shop: { owned: [], accent: 'default' }, texts: {}, writing: {}, pairs: {}, light: { best: 0, plays: 0 }, cando: {}, gift: null,
  plan: { months: 0, start: null },
  prefs: { theme: 'auto', rate: 0.95, voice: '', sound: true, haptics: true, mic: true, goal: 300, autoPt: false, newPer: 5, reviewMax: 6, pretest: true, retention: 0.9 },
  ui: { level: null, open: {}, gymRate: 1, libLevel: 'all', libStatus: 'all', radioPt: true, radioRep: 2, radioSrc: 'learned' }
});
let S;
let storageOk = true, saveWarned = false;
function mergeState(base, x) {
  const out = { ...base, ...(x || {}) };
  for (const k of ['streak', 'stats', 'prefs', 'ui', 'shop', 'light', 'plan']) out[k] = { ...base[k], ...((x && typeof x[k] === 'object' && x[k]) || {}) };
  for (const k of ['cards', 'xpDay', 'newDay', 'ach', 'imm', 'quests', 'texts', 'writing', 'pairs', 'cando']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
  if (![0, 3, 6, 9, 12].includes(out.plan.months)) out.plan.months = 0;
  if (out.plan.start && !/^\d{4}-\d{2}-\d{2}$/.test(out.plan.start)) out.plan.start = null;
  if (![0.85, 0.9, 0.95].includes(out.prefs.retention)) out.prefs.retention = 0.9;
  out.prefs.pretest = out.prefs.pretest !== false;
  if (!Array.isArray(out.extra)) out.extra = [];
  if (!Array.isArray(out.frozenDays)) out.frozenDays = [];
  if (!out.ui.open || typeof out.ui.open !== 'object') out.ui.open = {};
  if (!LEVELS.includes(out.startLevel)) out.startLevel = 'A1';
  if (!Array.isArray(out.shop.owned)) out.shop.owned = [];
  if (typeof out.coins !== 'number' || !isFinite(out.coins) || out.coins < 0) out.coins = 0;
  if (typeof out.xp !== 'number' || !isFinite(out.xp) || out.xp < 0) out.xp = 0;
  // drop damaged scheduling records (e.g. from a hand-edited or truncated backup) instead of crashing later
  for (const [id, c] of Object.entries(out.cards)) {
    const ok = c && typeof c === 'object' && [c.s, c.d, c.due, c.last].every(v => typeof v === 'number' && isFinite(v));
    if (!ok) delete out.cards[id];
  }
  if (!out.streak || typeof out.streak.count !== 'number' || !isFinite(out.streak.count)) out.streak = { ...base.streak };
  out.streak.freezes = clamp(Math.round(+out.streak.freezes || 0), 0, 3);
  if (out.streak.last && !/^\d{4}-\d{2}-\d{2}$/.test(out.streak.last)) out.streak.last = null;
  if (typeof out.prefs.goal !== 'number' || !(out.prefs.goal > 0)) out.prefs.goal = 300;
  if (typeof out.prefs.rate !== 'number' || !isFinite(out.prefs.rate)) out.prefs.rate = 0.95;
  out.prefs.rate = clamp(out.prefs.rate, 0.5, 1.6);
  return out;
}
function load() {
  let raw = null, st = null;
  try { raw = localStorage.getItem(KEY()); } catch { storageOk = false; }
  try { st = raw ? JSON.parse(raw) : null; } catch { st = null; }
  S = mergeState(DEFAULT(), st);
  if (!st && COURSE && COURSE.id === 'en') migrateOld();
}
function save() {
  try { localStorage.setItem(KEY(), JSON.stringify(S)); storageOk = true; }
  catch {
    storageOk = false;
    if (!saveWarned) { saveWarned = true; toast('Este navegador não está salvando o progresso. Exporte um backup no Perfil.', 'err'); }
  }
}
function migrateOld() {
  let old = null;
  try { old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null'); } catch { old = null; }
  if (!old || typeof old !== 'object') return;
  const ivls = [1, 3, 7, 14, 30, 60, 120];
  const exists = new Set((RAW.phrases || []).map(p => p.id));
  let n = 0;
  for (const [id, p] of Object.entries(old.progress || {})) {
    if (!p || !p.learned || !exists.has(id)) continue;
    const box = clamp(p.box | 0, 0, 6), s = ivls[box];
    let due = Date.now();
    if (typeof p.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.due)) { const [y, m, d] = p.due.split('-').map(Number); due = new Date(y, m - 1, d).getTime(); }
    S.cards[id] = { s, d: 5, r: 1 + box, l: 0, last: due - s * DAY, due };
    n++;
  }
  if (Array.isArray(old.extra)) S.extra = old.extra.filter(validPhrase).slice(0, 15000);
  if (old.prefs) {
    if (typeof old.prefs.rate === 'number') S.prefs.rate = clamp(old.prefs.rate, 0.6, 1.3);
    if (typeof old.prefs.voice === 'string') S.prefs.voice = old.prefs.voice;
  }
  S.migrated = n;
}

/* =========================================================
   Course model (phrases, units)
   ========================================================= */
let ALL = [], BYID = new Map(), LU = {}, UNITS = [];
function lemmaIdsJS(en) {
  const out = new Set();
  const toks = String(en).toLowerCase().replace(/[’‘]/g, "'").match(/[a-zà-ÿœ]+(?:'[a-zà-ÿœ]+)?/g) || [];
  const en_ = LANG && LANG.isEn;
  for (let t of toks) {
    if (en_ && t.endsWith("n't")) { if (LIDX.has('not')) out.add(LIDX.get('not')); t = t.slice(0, -3); if (t === 'wo') t = 'will'; if (t === 'ca') t = 'can'; }
    else if (t.includes("'")) t = en_ ? t.split("'")[0] : t.split("'").pop();
    const cands = en_ ? [t, t.replace(/ies$/, 'y'), t.replace(/es$/, ''), t.replace(/s$/, ''), t.replace(/ed$/, ''), t.replace(/ed$/, 'e'), t.replace(/ing$/, ''), t.replace(/ing$/, 'e'), t.replace(/ly$/, '')] : [t, t.replace(/s$/, ''), t.replace(/e?s$/, ''), t.replace(/x$/, '')];
    for (const c of cands) if (c && LIDX.has(c)) { out.add(LIDX.get(c)); break; }
  }
  return [...out];
}
function validPhrase(r) {
  return r && typeof r.en === 'string' && typeof r.pt === 'string' && r.en.trim().length >= 2 && r.en.length <= 350 &&
    r.pt.trim().length >= 1 && r.pt.length <= 500 && (!r.note || typeof r.note === 'string') && (!r.topic || typeof r.topic === 'string');
}
function cleanExtra(r, i) {
  return {
    id: typeof r.id === 'string' && /^X[\w-]{1,40}$/.test(r.id) ? r.id : 'X' + Date.now().toString(36) + '_' + i,
    en: r.en.trim(), pt: r.pt.trim(), note: String(r.note || '').slice(0, 700), topic: String(r.topic || 'Suas frases').slice(0, 90),
    level: LEVELS.includes(r.level) ? r.level : 'B1', focus: String(r.focus || '').slice(0, 100), sound: String(r.sound || '').slice(0, 200), extra: true
  };
}
function buildCourse() {
  const base = Array.isArray(RAW.phrases) ? RAW.phrases.filter(validPhrase) : [];
  const seen = new Set(base.map(p => p.id));
  const extra = [];
  S.extra.forEach((r, i) => { if (!validPhrase(r)) return; const c = cleanExtra(r, i); if (seen.has(c.id)) return; seen.add(c.id); c.w = lemmaIdsJS(c.en); extra.push(c); });
  S.extra = extra.map(({ w, extra, ...rest }) => rest);
  ALL = base.concat(extra);
  BYID = new Map(ALL.map(p => [p.id, p]));
  for (const p of ALL) {
    if (!LEVELS.includes(p.level)) p.level = 'B1';
    if (!Array.isArray(p.w)) p.w = LIDX.size ? lemmaIdsJS(p.en) : [];
    // normalised forms are computed once: distractor selection and synonym lookup run them thousands of times
    p._nen = norm(p.en); p._npt = norm(p.pt);
    p._s = p._nen + ' ' + p._npt + ' ' + norm(p.topic || '');
  }
  LU = {}; UNITS = [];
  for (const L of LEVELS) {
    const ph = ALL.filter(p => p.level === L);
    LU[L] = [];
    for (let i = 0; i < ph.length; i += UNIT_SIZE) {
      const u = { id: L + '-' + (LU[L].length + 1), level: L, n: LU[L].length + 1, ph: ph.slice(i, i + UNIT_SIZE) };
      LU[L].push(u); UNITS.push(u);
    }
  }
  bump();
}
const memo = new Map();
function bump() { memo.clear(); }
function cached(key, fn) { if (memo.has(key)) return memo.get(key); const v = fn(); memo.set(key, v); return v; }
const unitDone = u => u.ph.every(p => S.cards[p.id]);
const unitStarted = u => u.ph.some(p => S.cards[p.id]);
function levelDone(L) { return cached('ld' + L, () => LU[L].length > 0 && LU[L].every(unitDone)); }
function levelPct(L) { return cached('lp' + L, () => { const all = LU[L].reduce((a, u) => a + u.ph.length, 0); if (!all) return 0; const d = LU[L].reduce((a, u) => a + u.ph.filter(p => S.cards[p.id]).length, 0); return Math.round(d * 100 / all); }); }
function isUnlocked(u) {
  if (unitStarted(u)) return true;
  if (u.n === 1) { const li = LEVELS.indexOf(u.level); return li <= LEVELS.indexOf(S.startLevel) || (li > 0 && levelDone(LEVELS[li - 1])); }
  return unitDone(LU[u.level][u.n - 2]);
}
function nextUnit() {
  return cached('next', () => {
    const si = LEVELS.indexOf(S.startLevel);
    const order = LEVELS.slice(si).concat(LEVELS.slice(0, si));
    for (const L of order) for (const u of LU[L]) if (!unitDone(u) && isUnlocked(u)) return u;
    return null;
  });
}
function unitTopics(u) { const c = {}; u.ph.forEach(p => { c[p.topic] = (c[p.topic] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(x => x[0]); }
function dueList() {
  return cached('due', () => {
    const lim = tomorrow(), out = [];
    for (const [id, c] of Object.entries(S.cards)) if (c.due < lim && BYID.has(id)) out.push(BYID.get(id));
    return out.sort((a, b) => S.cards[a.id].due - S.cards[b.id].due);
  });
}
function learnedList() { return cached('learned', () => ALL.filter(p => S.cards[p.id])); }
function vocab() {
  return cached('vocab', () => {
    const known = new Set();
    for (const p of learnedList()) for (const i of p.w) known.add(i);
    for (const t of TEXTS) if ((S.texts[t.id] && S.texts[t.id].best || 0) >= 0.6 && Array.isArray(t.w)) for (const i of t.w) known.add(i);
    let cov = 0; for (const i of known) cov += LEX.mass[i] || 0;
    return { count: known.size, cov, known };
  });
}

/* =========================================================
   FSRS-4.5 (spaced repetition)
   ========================================================= */
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81;
const retr = (t, s) => Math.pow(1 + FACTOR * t / s, DECAY);
const d0 = g => clamp(W[4] - (g - 3) * W[5], 1, 10);
function fuzz(ivl) { return ivl < 3 ? ivl : Math.max(1, Math.round(ivl * (0.95 + Math.random() * 0.1))); }
function fsrsNew(g) {
  const now = Date.now();
  return { s: +W[g - 1].toFixed(4), d: +d0(g).toFixed(4), r: 1, l: 0, last: now, due: dueIn(g === 1 ? 0 : g === 4 ? 3 : 1), first: now };
}
function fsrsReview(c, g) {
  const now = Date.now();
  const t = Math.max(0, (now - (c.last || now)) / DAY);
  const s0 = Math.max(0.1, c.s || 1), dd = clamp(c.d || 5, 1, 10);
  const R = retr(t, s0);
  let d = dd - W[6] * (g - 3); d = W[7] * d0(3) + (1 - W[7]) * d; d = clamp(d, 1, 10);
  let s;
  if (g === 1) s = Math.min(s0, W[11] * Math.pow(dd, -W[12]) * (Math.pow(s0 + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)));
  else s = s0 * (Math.exp(W[8]) * (11 - dd) * Math.pow(s0, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1) + 1);
  s = clamp(s, 0.1, 36500);
  const ivl = g === 1 ? 1 : Math.min(3650, fuzz(Math.max(1, Math.round(intervalFor(s)))));
  return { ...c, s: +s.toFixed(4), d: +d.toFixed(4), r: (c.r || 0) + 1, l: (c.l || 0) + (g === 1 ? 1 : 0), last: now, due: dueIn(ivl) };
}
// FSRS: the interval at which retrievability falls to the desired retention (0.9 → interval = stability)
function intervalFor(s) { const R = (S && S.prefs.retention) || 0.9; return s * (Math.pow(R, 1 / DECAY) - 1) / FACTOR; }
function retrievability(c) { return retr(Math.max(0, (Date.now() - c.last) / DAY), Math.max(0.1, c.s)); }

/* =========================================================
   Text normalisation & answer matching
   ========================================================= */
// accent-insensitive, punctuation-free, lower-case form of any Latin-script text (works for English, French, Latin...)
const latin = s => String(s || '').toLowerCase().replace(/[œ]/g, 'oe').replace(/[æ]/g, 'ae').replace(/ß/g, 'ss').normalize('NFKD').replace(/[̀-ͯ]/g, '');
function norm(s) {
  let t = latin(s).replace(/[’‘`´]/g, "'").replace(/[-–—/]/g, ' ');
  t = t.replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
  const contr = LANG ? LANG.contr : CONTR_EN, numw = LANG ? LANG.numw : PROFILES.en.numw;
  for (const [r, v] of contr) t = t.replace(r, v);
  if (numw.length) t = t.replace(/\b(\d{1,2})\b/g, (m, d) => numw[+d] ? latin(numw[+d]).replace(/[^a-z ]/g, ' ') : m);
  return t.replace(/'/g, '').replace(/\s+/g, ' ').trim();
}
const toks = s => norm(s).split(' ').filter(Boolean);
function near(a, b) { if (a === b) return 0; const L = Math.max(a.length, b.length); const tol = L >= 8 ? 2 : L >= 4 ? 1 : 0; const d = lev(a, b); return d <= tol ? 1 : 2; }
function align(refText, hypText) {
  const R = toks(refText), H = toks(hypText);
  const m = R.length, n = H.length;
  const D = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) D[i][0] = i;
  for (let j = 0; j <= n; j++) D[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = near(R[i - 1], H[j - 1]);
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (c === 0 ? 0 : c === 1 ? 0.25 : 1));
  }
  const hyp = [], missing = [];
  let i = m, j = n, ok = 0, typos = 0, bad = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const c = near(R[i - 1], H[j - 1]); const cost = c === 0 ? 0 : c === 1 ? 0.25 : 1;
      if (Math.abs(D[i][j] - (D[i - 1][j - 1] + cost)) < 1e-9) {
        if (c === 0) { hyp.unshift({ w: H[j - 1], k: 'ok' }); ok++; }
        else if (c === 1) { hyp.unshift({ w: H[j - 1], k: 'typo', r: R[i - 1] }); typos++; ok++; }
        else { hyp.unshift({ w: H[j - 1], k: 'bad' }); missing.unshift(R[i - 1]); bad++; }
        i--; j--; continue;
      }
    }
    if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + 1)) < 1e-9) { missing.unshift(R[i - 1]); hyp.unshift({ w: '', k: 'gap', r: R[i - 1] }); bad++; i--; continue; }
    hyp.unshift({ w: H[j - 1], k: 'bad' }); bad++; j--;
  }
  const score = (m || n) ? ok / Math.max(m, n) : 0;
  return { ok: bad === 0 && m > 0, typos, score, hyp, missing, refLen: m };
}
function diffNode(res) {
  const wrap = h('div', { class: 'diff' });
  res.hyp.forEach((t, i) => {
    if (i) put(wrap, ' ');
    if (t.k === 'gap') put(wrap, h('span', { class: 'miss', title: 'Faltou' }, t.r));
    else put(wrap, h('span', { class: t.k === 'ok' ? 'ok' : t.k === 'typo' ? 'typo' : 'bad', title: t.k === 'typo' ? 'Grafia: ' + t.r : null }, t.w));
  });
  return wrap;
}

/* =========================================================
   Speech: synthesis, recognition, recording
   ========================================================= */
const TTS = { ok: typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined', en: null, pt: null, list: [], keep: new Set(), warned: false };
const normLang = l => String(l || '').replace('_', '-').toLowerCase();
function voiceScore(v) {
  const want = LANG ? LANG.code.toLowerCase() : 'en-us', short = LANG ? LANG.short : 'en';
  const l = normLang(v.lang); if (!l.startsWith(short)) return -99;
  let s = l === want ? 10 : 4;
  if (short === 'en' && l === 'en-gb') s = 6;
  const n = String(v.name || '').toLowerCase();
  const vp = LANG ? LANG.voices : PROFILES.en.voices;
  if (/natural|neural|premium|enhanced|online/.test(n)) s += 6;
  if (vp.good.test(n)) s += 3;
  if (vp.bad.test(n)) s -= 30;
  if (v.localService) s += 1;
  return s;
}
function loadVoices() {
  if (!TTS.ok) return;
  let vs = [];
  try { vs = speechSynthesis.getVoices() || []; } catch { vs = []; }
  const short = LANG ? LANG.short : 'en';
  TTS.list = vs.filter(v => normLang(v.lang).startsWith(short)).sort((a, b) => voiceScore(b) - voiceScore(a));
  TTS.en = TTS.list.find(v => S && v.voiceURI === S.prefs.voice) || TTS.list.find(v => voiceScore(v) > 0) || TTS.list[0] || null;
  TTS.en2 = TTS.list.find(v => v !== TTS.en && voiceScore(v) > 0 && normLang(v.lang) === normLang(TTS.en && TTS.en.lang)) || TTS.list.find(v => v !== TTS.en && voiceScore(v) > 0) || null;
  const pts = vs.filter(v => normLang(v.lang) === 'pt-br');
  TTS.pt = pts.find(v => /natural|neural|online|enhanced|premium|luciana|francisca|google/i.test(v.name)) || pts[0] || vs.find(v => normLang(v.lang).startsWith('pt')) || null;
}
let speakId = 0;
function speak(text, opt = {}) {
  if (!TTS.ok || !text) { opt.onend && opt.onend(false); return; }
  const id = ++speakId;
  let busy = false;
  try { busy = speechSynthesis.speaking || speechSynthesis.pending; if (busy) speechSynthesis.cancel(); } catch {}
  const u = new SpeechSynthesisUtterance(String(text));
  const pt = opt.lang === 'pt';
  const v = pt ? TTS.pt : opt.voiceObj !== undefined ? (opt.voiceObj || TTS.en) : opt.alt ? (TTS.en2 || TTS.en) : TTS.en;
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = pt ? 'pt-BR' : LANG.code;
  u.rate = clamp(opt.rate || S.prefs.rate, 0.5, 1.6); u.pitch = 1; u.volume = 1;
  TTS.keep.add(u);
  const done = ok => { TTS.keep.delete(u); if (id === speakId && opt.onend) opt.onend(ok); };
  u.onend = () => done(true);
  u.onerror = e => {
    done(false);
    if (e && e.error && !['canceled', 'interrupted'].includes(e.error) && !TTS.warned) { TTS.warned = true; toast('Não consegui tocar o áudio. Confira se há uma voz em ' + LANG.name + ' instalada (Perfil › Voz).', 'err'); }
  };
  if (opt.onstart) u.onstart = opt.onstart;
  const go = () => { if (id !== speakId) { TTS.keep.delete(u); return; } try { speechSynthesis.speak(u); if (speechSynthesis.paused) speechSynthesis.resume(); } catch { done(false); } };
  // Safari can drop an utterance queued right after cancel(); give it a beat when something was playing
  if (busy && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent)) setTimeout(go, 60); else go();
}
function stopSpeak() { speakId++; if (TTS.ok) { try { speechSynthesis.cancel(); } catch {} } }
const speakP = (text, opt = {}) => new Promise(res => {
  let done = false; const fin = v => { if (!done) { done = true; clearTimeout(t); res(v); } };
  const t = setTimeout(() => fin(false), 2500 + String(text).length * 140 / (opt.rate || 1));
  speak(text, { ...opt, onend: fin });
});

const SRC = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let micSnooze = 0, activeRec = null;
const canSpeak = () => !!SRC && S.prefs.mic && Date.now() > micSnooze;
function recognize({ onInterim, onDone, onError }) {
  let r;
  try { r = new SRC(); } catch { onError && onError('unsupported'); return null; }
  r.lang = LANG.code; r.interimResults = true; r.maxAlternatives = 4; r.continuous = false;
  let alts = [], finished = false;
  r.onresult = e => {
    let interim = ''; const fin = [];
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) for (let j = 0; j < res.length; j++) fin[j] = ((fin[j] || '') + ' ' + res[j].transcript).trim();
      else interim += res[0].transcript;
    }
    if (fin.length) alts = fin;
    onInterim && onInterim(interim || (fin[0] || ''));
  };
  r.onerror = e => { finished = true; activeRec = null; onError && onError(e.error || 'error'); };
  r.onend = () => { activeRec = null; if (!finished) { finished = true; onDone && onDone(alts); } };
  try { r.start(); activeRec = r; } catch { onError && onError('start'); return null; }
  return r;
}
function stopRec() { if (activeRec) { try { activeRec.abort(); } catch {} activeRec = null; } }
const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
let recState = null;
async function recordCompare(btn, phrase) {
  if (recState) { recState.stop(); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast('Microfone indisponível. Permita o acesso ao microfone para gravar sua voz.', 'err'); return; }
  const chunks = []; let mr;
  try { mr = new MediaRecorder(stream); } catch { stream.getTracks().forEach(t => t.stop()); toast('Este navegador não grava áudio.', 'err'); return; }
  const label = btn.querySelector('span');
  const old = label.textContent;
  btn.classList.add('recording'); label.textContent = 'Gravando… toque para parar';
  const maxMs = Math.min(9000, 2500 + phrase.split(/\s+/).length * 450);
  const timer = setTimeout(() => recState && recState.stop(), maxMs);
  recState = { stop: () => { clearTimeout(timer); try { mr.state !== 'inactive' && mr.stop(); } catch {} } };
  mr.ondataavailable = e => e.data && e.data.size && chunks.push(e.data);
  mr.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    recState = null; btn.classList.remove('recording'); label.textContent = old;
    if (!chunks.length) return;
    const url = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
    speak(phrase, { onend: () => { const a = new Audio(url); a.onended = () => URL.revokeObjectURL(url); a.play().catch(() => {}); } });
    toast('Ouça o modelo e depois a sua voz. Compare ritmo e entonação.');
  };
  mr.start();
}

/* =========================================================
   Sound effects, haptics, confetti
   ========================================================= */
let AC = null;
function ac() {
  if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch { return null; } }
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
function tone(f, at, dur, type = 'sine', vol = 0.09) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
const SFX = {
  ok(c = 0) { if (!S.prefs.sound) return; const k = 1 + Math.min(c, 12) * 0.035; tone(784 * k, 0, 0.12, 'triangle'); tone(1175 * k, 0.07, 0.22, 'triangle'); },
  bad() { if (!S.prefs.sound) return; tone(196, 0, 0.16, 'sawtooth', 0.04); tone(147, 0.11, 0.26, 'sawtooth', 0.04); },
  done() { if (!S.prefs.sound) return; [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.32, 'triangle', 0.08)); },
  chest() { if (!S.prefs.sound) return; for (let i = 0; i < 9; i++) tone(900 + i * 160, i * 0.035, 0.14, 'sine', 0.05); },
  level() { if (!S.prefs.sound) return; [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.4, 'square', 0.035)); },
  tick() { if (!S.prefs.sound) return; tone(660, 0, 0.05, 'sine', 0.03); },
  crit() { if (!S.prefs.sound) return; [988, 1319, 1568, 1976].forEach((f, i) => tone(f, i * 0.06, 0.18, 'triangle', 0.07)); tone(2637, 0.26, 0.35, 'sine', 0.05); }
};
const buzz = p => { if (S.prefs.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch {} } };
function confetti(n = 140) {
  if (reduceMotion()) return;
  const cv = $('#confetti'); const ctx = cv.getContext('2d'); if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), Wd = innerWidth, Ht = innerHeight;
  cv.width = Wd * dpr; cv.height = Ht * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--signal', '--amber', '--mint', '--coral', '--flame'].map(v => cs.getPropertyValue(v).trim() || '#3446F0');
  const parts = Array.from({ length: n }, () => ({ x: Wd / 2 + (Math.random() - 0.5) * Wd * 0.3, y: Ht * 0.32, vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: pick(cols) }));
  const t0 = performance.now();
  (function frame(t) {
    const el = t - t0; ctx.clearRect(0, 0, Wd, Ht);
    for (const p of parts) { p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - el / 2400); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore(); }
    if (el < 2400) requestAnimationFrame(frame); else ctx.clearRect(0, 0, Wd, Ht);
  })(t0);
}

/* =========================================================
   Toasts & modals
   ========================================================= */
function toast(msg, kind = '', ic = null) {
  const box = $('#toasts'); if (!box) return;
  const t = h('div', { class: 'toast ' + kind, role: 'status' }, ic ? icon(ic) : null, h('span', null, msg));
  put(box, t);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, kind === 'ach' ? 3800 : 3200);
}
let modalClose = null;
function openModal(nodes, onClose) {
  const box = $('#modalBox'); kids(box, ...[].concat(nodes));
  $('#modal').hidden = false; modalClose = onClose || null;
  const f = box.querySelector('.acts .btn') || box.querySelector('.btn,button,input,select'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30);
}
function closeModal() { if ($('#modal').hidden) return; $('#modal').hidden = true; kids($('#modalBox'), ); const c = modalClose; modalClose = null; c && c(); }
function confirmBox(title, text, okLabel, danger = false) {
  return new Promise(res => {
    let answered = false;
    const fin = v => { if (answered) return; answered = true; closeModal(); res(v); };
    openModal([
      h('h2', null, title), text ? h('p', { class: 'muted' }, text) : null,
      h('div', { class: 'acts' },
        h('button', { class: 'btn block ' + (danger ? 'bad' : ''), onclick: () => fin(true) }, okLabel),
        h('button', { class: 'btn ghost block', onclick: () => fin(false) }, 'Cancelar'))
    ], () => { if (!answered) { answered = true; res(false); } });
  });
}

/* =========================================================
   XP, levels, streak, achievements
   ========================================================= */
const today = () => dayKey();
const xpToday = () => S.xpDay[today()] || 0;
const playerLevel = xp => Math.floor((1 + Math.sqrt(1 + (4 * xp) / 250)) / 2);
const levelFloor = L => 250 * L * (L - 1);
function addXP(n) {
  const boost = Date.now() < S.boostUntil ? 2 : 1;
  const g = Math.round(n * boost);
  const beforeLvl = playerLevel(S.xp), beforeDay = xpToday();
  S.xp += g; S.xpDay[today()] = beforeDay + g;
  // celebrations are shown on the lesson's result screen; outside a lesson they appear right away as a toast
  if (beforeDay < S.prefs.goal && beforeDay + g >= S.prefs.goal) {
    if (L) pendingGoal = true; else setTimeout(() => { SFX.done(); toast('Meta diária cumprida! ' + S.prefs.goal + ' XP hoje.', 'ach', 'target'); }, 600);
  }
  questEvent('xp', g);
  const after = playerLevel(S.xp);
  if (after > beforeLvl) { if (L) pendingLevel = after; else { SFX.level(); toast('Você chegou ao nível ' + after + '!', 'ach', 'star'); } }
  return g;
}
let pendingGoal = false, pendingLevel = 0;
function addCoins(n) { n = Math.max(0, Math.round(n)); S.coins += n; S.stats.coinsEarned = (S.stats.coinsEarned || 0) + n; return n; }
function displayStreak() {
  const st = S.streak; if (!st.last) return 0;
  const gap = keyDiff(st.last, today());
  if (gap <= 1) return st.count;
  return gap - 1 <= st.freezes ? st.count : 0;
}
function touchStreak() {
  const st = S.streak, t = today();
  if (st.last === t) return { extended: false, count: st.count };
  let saved = 0;
  if (!st.last) st.count = 1;
  else {
    const gap = keyDiff(st.last, t);
    if (gap === 1) st.count++;
    else if (gap > 1 && gap - 1 <= st.freezes) { saved = gap - 1; st.freezes -= saved; for (let i = 1; i < gap; i++) S.frozenDays.push(keyAdd(st.last, i)); st.count++; }
    else st.count = 1;
  }
  S.frozenDays = S.frozenDays.slice(-60);
  st.last = t; st.best = Math.max(st.best || 0, st.count);
  if (st.count % 7 === 0 && st.freezes < 3) st.freezes++;
  return { extended: true, count: st.count, saved };
}
let ACH = [];
const buildAch = () => [
  { id: 'first', t: 'Primeiro passo', d: 'Conclua sua primeira lição', ok: () => S.stats.lessons >= 1 },
  { id: 's3', t: 'Aquecendo', d: '3 dias seguidos', ok: () => S.streak.best >= 3 },
  { id: 's7', t: 'Uma semana inteira', d: '7 dias seguidos', ok: () => S.streak.best >= 7 },
  { id: 's30', t: 'Hábito formado', d: '30 dias seguidos', ok: () => S.streak.best >= 30 },
  { id: 's100', t: 'Imparável', d: '100 dias seguidos', ok: () => S.streak.best >= 100 },
  { id: 'p50', t: '50 frases', d: 'Aprenda 50 frases', ok: () => learnedList().length >= 50 },
  { id: 'p250', t: '250 frases', d: 'Aprenda 250 frases', ok: () => learnedList().length >= 250 },
  { id: 'p1000', t: 'Mil frases', d: 'Aprenda 1.000 frases', ok: () => learnedList().length >= 1000 },
  { id: 'p2500', t: '2.500 frases', d: 'Aprenda 2.500 frases', ok: () => learnedList().length >= 2500 },
  { id: 'w1000', t: '1.000 palavras', d: 'Reconheça 1.000 palavras de alta frequência', ok: () => vocab().count >= 1000 },
  { id: 'w3000', t: '3.000 palavras', d: 'Reconheça 3.000 palavras de alta frequência', ok: () => vocab().count >= 3000 },
  { id: 'c10', t: 'Em chamas', d: 'Acerte 10 seguidas', ok: () => S.stats.maxCombo >= 10 },
  { id: 'c30', t: 'Sem errar', d: 'Acerte 30 seguidas', ok: () => S.stats.maxCombo >= 30 },
  { id: 'perf1', t: 'Lição perfeita', d: 'Termine uma lição sem erros', ok: () => S.stats.perfect >= 1 },
  { id: 'perf25', t: 'Precisão cirúrgica', d: '25 lições perfeitas', ok: () => S.stats.perfect >= 25 },
  { id: 'd100', t: 'Ouvido afiado', d: 'Faça 100 ditados', ok: () => S.stats.dictations >= 100 },
  { id: 'sp50', t: 'Voz ativa', d: 'Fale 50 frases no microfone', ok: () => S.stats.speaks >= 50 },
  { id: 'r500', t: 'Memória de elefante', d: '500 revisões', ok: () => S.stats.reviews >= 500 },
  { id: 'i5h', t: 'Imersão', d: '5 horas de ' + LANG.name + ' real registradas', ok: () => immTotal() >= 300 },
  { id: 'i30h', t: 'Maratonista', d: '30 horas de ' + LANG.name + ' real', ok: () => immTotal() >= 1800 },
  ...LEVELS.map(L => ({ id: 'lv' + L, t: 'Nível ' + L + ' completo', d: 'Conclua todas as lições ' + L, ok: () => levelDone(L) })),
  { id: 'tx1', t: 'Primeira história', d: 'Complete um texto ou áudio', ok: () => (S.stats.texts || 0) >= 1 },
  { id: 'tx15', t: 'Leitor voraz', d: 'Complete 15 textos ou áudios', ok: () => (S.stats.texts || 0) >= 15 },
  { id: 'rp1', t: 'Quebrando o gelo', d: 'Complete uma conversa', ok: () => (S.stats.rp || 0) >= 1 },
  { id: 'rp20', t: 'Bom de papo', d: 'Complete 20 conversas', ok: () => (S.stats.rp || 0) >= 20 },
  { id: 'wr1', t: 'Primeiro texto', d: 'Escreva um texto guiado', ok: () => (S.stats.writings || 0) >= 1 },
  { id: 'wr10', t: 'Escritor', d: 'Escreva 10 textos', ok: () => (S.stats.writings || 0) >= 10 },
  { id: 'snd', t: 'Ouvido absoluto', d: 'Domine 6 sons (85% de acerto)', ok: () => PAIRS.filter(c => (pairAcc(c.id) || 0) >= 0.85).length >= 6 },
  { id: 'lt20', t: 'Relâmpago', d: 'Faça 20 pontos no Desafio relâmpago', ok: () => (S.light.best || 0) >= 20 },
  { id: 'lt40', t: 'Velocidade da luz', d: 'Faça 40 pontos no Desafio relâmpago', ok: () => (S.light.best || 0) >= 40 },
  { id: 'crit', t: 'Golpe crítico', d: 'Consiga 25 acertos críticos', ok: () => (S.stats.crit || 0) >= 25 },
  { id: 'q30', t: 'Caçador de missões', d: 'Complete 30 missões', ok: () => (S.stats.quests || 0) >= 30 },
  { id: 'night', t: 'Coruja', d: 'Estude depois das 23h', ok: () => S.stats.night >= 1 },
  { id: 'early', t: 'Madrugador', d: 'Estude antes das 7h', ok: () => S.stats.early >= 1 }
];
function checkAch() {
  let n = 0;
  for (const a of ACH) {
    if (S.ach[a.id]) continue;
    let ok = false; try { ok = a.ok(); } catch { ok = false; }
    if (ok) { S.ach[a.id] = Date.now(); n++; setTimeout(() => { toast('Conquista: ' + a.t, 'ach', 'star'); SFX.chest(); }, 400 * n); }
  }
  if (n) save();
}
const immTotal = () => Object.values(S.imm).reduce((a, b) => a + (+b || 0), 0);

/* =========================================================
   Exercise selection
   ========================================================= */
const PRODUCTIVE = new Set(['build', 'cloze', 'dictation', 'translate', 'speak', 'shadow']);
const STOP = () => LANG.stop;
function tilesOf(p) {
  return p.en.split(/\s+/).map(w => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '').replace(/[’‘]/g, "'")).filter(Boolean);
}
const canBuild = p => { const n = tilesOf(p).length; return n >= 3 && n <= 14; };
function clozeTarget(p) {
  return cached('cz' + p.id, () => {
    const en = p.en.replace(/[’‘]/g, "'");
    const f = String(p.focus || '').replace(/[’‘]/g, "'").trim();
    if (f && f.length >= 2 && f.split(/\s+/).length <= 4) {
      const i = en.toLowerCase().indexOf(f.toLowerCase());
      if (i >= 0) {
        const before = en[i - 1], after = en[i + f.length];
        if ((!before || /[^\p{L}]/u.test(before)) && (!after || /[^\p{L}]/u.test(after))) return { i, len: f.length, text: en.substr(i, f.length), focus: true };
      }
    }
    let best = null;
    const re = /[A-Za-zÀ-ÿœ][A-Za-zÀ-ÿœ']*/g; let m;
    while ((m = re.exec(en))) { const w = m[0]; if (STOP().has(latin(w)) || w.length < 4) continue; if (!best || w.length > best.len) best = { i: m.index, len: w.length, text: w }; }
    return best;
  });
}
function eligible(t, p) {
  if (t === 'listen' || t === 'dictation' || t === 'shadow') return TTS.ok;
  if (t === 'build') return canBuild(p);
  if (t === 'cloze') return !!clozeTarget(p);
  if (t === 'speak') return canSpeak();
  if (t === 'pair') return TTS.ok;
  return true;
}
function recogType(p) { return TTS.ok && Math.random() < 0.6 ? 'listen' : 'read'; }
function produceType(p) {
  const pool = ['build', 'build', 'build', 'cloze'].filter(t => eligible(t, p));
  return pool.length ? pick(pool) : 'read';
}
function reviewType(p, c) {
  const s = c ? c.s : 0;
  let pool;
  if (s < 4) pool = ['listen', 'read', 'build', 'build', 'cloze'];
  else if (s < 12) pool = ['build', 'cloze', 'dictation', 'listen', 'translate'];
  else if (s < 40) pool = ['dictation', 'translate', 'cloze', 'speak', 'speak'];
  else pool = ['translate', 'speak', 'dictation', 'speak'];
  pool = pool.filter(t => eligible(t, p));
  return pool.length ? pick(pool) : 'read';
}
function easier(t, p) {
  if (['translate', 'dictation', 'speak', 'shadow', 'cloze'].includes(t)) return canBuild(p) ? 'build' : 'read';
  if (t === 'build') return 'read';
  return t;
}
// phrases that mean the same thing (same translation or same English) must never appear as a "wrong" option
const sameMeaning = (p, q) => q._npt === p._npt || q._nen === p._nen;
function synonymsEn(p) { return cached('syn' + p.id, () => { const k = p._npt; return ALL.filter(q => q.id !== p.id && q._npt === k).map(q => q.en); }); }
function bestAlign(refs, hyp) { let best = null; for (const r of refs) { const a = align(r, hyp); if (!best || a.score > best.score || (a.ok && !best.ok)) best = a; } return best; }
function distractors(p, field, n = 3) {
  const nf = field === 'pt' ? '_npt' : '_nen', target = p[nf];
  const L = LEVELS.indexOf(p.level);
  // sample first, filter after: with 8,000 phrases a full scan per exercise would be noticeable on phones
  const near_ = q => q.id !== p.id && Math.abs(LEVELS.indexOf(q.level) - L) <= 1 && !sameMeaning(p, q);
  const sample = [];
  for (let tries = 0; tries < 400 && sample.length < 60; tries++) { const q = ALL[Math.floor(Math.random() * ALL.length)]; if (near_(q) && !sample.includes(q)) sample.push(q); }
  if (sample.length < 12) for (const q of shuffle(ALL)) { if (q.id !== p.id && !sameMeaning(p, q) && !sample.includes(q)) sample.push(q); if (sample.length >= 60) break; }
  const len = p[field].length;
  sample.sort((a, b) => Math.abs(a[field].length - len) - Math.abs(b[field].length - len));
  const out = [], seen = new Set([target]);
  for (const q of sample.slice(0, 14).sort(() => Math.random() - 0.5)) {
    const k = q[nf]; if (seen.has(k)) continue; seen.add(k); out.push(q[field]); if (out.length >= n) break;
  }
  return out;
}

/* =========================================================
   Lesson engine
   ========================================================= */
let L = null;
const mk = (type, p) => ({ type, p });
function buildUnitItems(u) {
  const fresh = u.ph.filter(p => !S.cards[p.id]);
  if (!fresh.length) return buildPracticeItems(u.ph);
  const newP = fresh.slice(0, S.prefs.newPer);
  const unitIds = new Set(u.ph.map(p => p.id));
  const revs = dueList().filter(p => !unitIds.has(p.id)).slice(0, S.prefs.reviewMax);
  const items = [];
  const warm = revs.splice(0, Math.min(2, revs.length));
  warm.forEach(p => items.push(mk(reviewType(p, S.cards[p.id]), p)));
  newP.forEach((p, i) => {
    items.push(mk('intro', p));
    if (i > 0) items.push(mk(recogType(newP[i - 1]), newP[i - 1]));
  });
  items.push(mk(recogType(newP[newP.length - 1]), newP[newP.length - 1]));
  const prod = shuffle(newP).map(p => mk(produceType(p), p));
  const rv = revs.map(p => mk(reviewType(p, S.cards[p.id]), p));
  while (prod.length || rv.length) { if (prod.length) items.push(prod.shift()); if (rv.length) items.push(rv.shift()); }
  return items;
}
function buildPracticeItems(list) { return shuffle(list).map(p => mk(S.cards[p.id] ? reviewType(p, S.cards[p.id]) : produceType(p), p)); }
function startLesson(items, opts = {}) {
  if (!items.length) { toast('Nada para praticar aqui ainda.'); return; }
  stopRadio(); stopSpeak();
  pendingGoal = false; pendingLevel = 0;
  L = {
    mode: opts.mode || 'unit', unit: opts.unit || null, title: opts.title || 'Lição', rate: opts.rate || null,
    items: items.map(it => ({ ...it, slot: true })), i: 0, base: items.length, done: 0, xp: 0, combo: 0, maxCombo: 0, wrong: 0,
    t0: Date.now(), per: new Map(), phase: 'answer', finished: false, pushed: false, ex: null, answered: 0, correct: 0, hist: [], onFinish: opts.onFinish || null, kind: opts.kind || null
  };
  for (const it of L.items) if (!L.per.has(it.p.id)) L.per.set(it.p.id, { wrong: 0, hint: false, isNew: !S.cards[it.p.id], hard: false, slow: false, fin: false });
  const hr = new Date().getHours();
  if (hr >= 23) S.stats.night = (S.stats.night || 0) + 1;
  if (hr < 7 && hr >= 4) S.stats.early = (S.stats.early || 0) + 1;
  try { document.activeElement && document.activeElement.blur(); } catch {}
  $('#lesson').hidden = false; document.body.style.overflow = 'hidden'; document.body.classList.add('in-lesson');
  if (opts.fromStage) L.pushed = true; else { try { history.pushState({ fl: 1 }, ''); L.pushed = true; } catch {} }
  updateCombo(); renderItem();
}
const lessonOpen = () => !$('#lesson').hidden;
function closeLesson(fromPop = false) {
  stopSpeak(); stopRec(); if (recState) recState.stop();
  $('#lesson').hidden = true; $('#sheet').hidden = true; document.body.style.overflow = ''; document.body.classList.remove('in-lesson');
  const wasPushed = L && L.pushed;
  if (L && !L.finished && L.xp) { S.stats.secs += Math.round((Date.now() - L.t0) / 1000); save(); }
  L = null;
  if (wasPushed && !fromPop) { ignorePop = true; try { history.back(); } catch { ignorePop = false; } }
  render();
}
async function askExit() {
  if (!L || L.finished) { closeLesson(); return; }
  const ok = await confirmBox('Sair da lição?', 'O XP que você já ganhou fica salvo. As frases que você não terminou voltam na próxima lição.', 'Sair da lição', true);
  if (ok) closeLesson();
}
function rateNow() { return (L && L.rate) || S.prefs.rate; }
function sayP(p, slow = false) { speak(p.en, { rate: slow ? Math.max(0.5, rateNow() * 0.7) : rateNow() }); }
function updateBar() {
  const pct = L ? Math.min(100, Math.round(L.done * 100 / Math.max(1, L.base))) : 0;
  $('#lessonBar span').style.width = pct + '%'; $('#lessonBar').setAttribute('aria-valuenow', pct);
}
function updateCombo() {
  const c = $('#combo');
  if (!L || L.combo < 3) { c.hidden = true; return; }
  c.hidden = false; c.classList.toggle('hot', L.combo >= 10); c.querySelector('b').textContent = L.combo;
  c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
}
function foot(...btns) { kids($('#lessonFoot'), h('div', { class: 'l-foot-in' }, ...btns)); }
function head(kind, hint) { return [h('h2', { class: 'ex-kind' }, kind), hint ? h('p', { class: 'ex-hint' }, hint) : null]; }
function remainingFor(id) { return L.items.slice(L.i + 1).some(it => it.p.id === id); }

function renderItem() {
  const it = L.items[L.i];
  L.phase = 'answer'; L.tItem = Date.now(); L.ex = null;
  $('#sheet').hidden = true; updateBar();
  const inner = $('#lessonInner'); kids(inner, );
  $('#lessonBody').scrollTop = 0;
  adapt(it);
  if (!eligible(it.type, it.p) && !['intro', 'mcq'].includes(it.type)) it.type = easier(it.type, it.p) === it.type ? 'read' : easier(it.type, it.p);
  const R = { intro: exIntro, listen: exListen, read: exRead, build: exBuild, cloze: exCloze, dictation: exDictation, translate: exTranslate, speak: exSpeak, shadow: exShadow, pair: exPair, mcq: exMcq }[it.type] || exRead;
  R(it, inner);
  const mb = $('#mainBtn'); if (mb && !mb.disabled && !(L.ex && L.ex.typing)) mb.focus({ preventScroll: true }); else $('#lessonInner').focus({ preventScroll: true });
}

/* ---- intro ---- */
function phraseNode(p, opts = {}) {
  const el = h('div', { class: 'phrase-en', lang: LANG.code });
  const f = clozeTarget(p);
  const en = p.en.replace(/[’‘]/g, "'");
  const re = /\S+/g; let m, first = true;
  while ((m = re.exec(en))) {
    if (!first) put(el, ' ');
    first = false;
    const w = m[0], clean = w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
    const inFocus = opts.focus && f && f.focus && m.index < f.i + f.len && m.index + w.length > f.i;
    const span = h('span', { class: 'w' + (inFocus ? ' focus' : '') }, w);
    if (clean && opts.tap) span.addEventListener('click', () => { span.classList.add('say'); speak(clean, { rate: 0.85, onend: () => span.classList.remove('say') }); });
    put(el, span);
  }
  return el;
}
function audioButtons(p, extra = []) {
  const row = h('div', { class: 'audio-row' });
  if (TTS.ok) {
    put(row, h('button', { class: 'audio-btn', onclick: () => sayP(p) }, icon('speaker'), h('span', null, 'Ouvir')));
    put(row, h('button', { class: 'audio-btn', onclick: () => sayP(p, true) }, icon('slow'), h('span', null, 'Devagar')));
  }
  extra.forEach(e => put(row, e));
  return row;
}
// Backchaining: the phrase is built up from its end ("you?", "are you?", "How are you?"), which keeps the
// natural final intonation intact and is the classic drill for long chunks in pronunciation teaching.
let chainTok = 0;
async function backchain(p, btn) {
  const words = p.en.split(/\s+/); const n = words.length;
  if (!TTS.ok || n < 2) { sayP(p); return; }
  const my = ++chainTok; stopSpeak();
  const step = n <= 5 ? 1 : n <= 9 ? 2 : 3;
  const starts = []; for (let k = step; k < n; k += step) starts.push(n - k); starts.push(0);
  btn && btn.classList.add('recording');
  for (const s of starts) {
    if (my !== chainTok) break;
    const ok = await speakP(words.slice(s).join(' '), { rate: Math.max(0.5, rateNow() * 0.85) });
    if (!ok || my !== chainTok) break;
    await wait(420);
  }
  btn && btn.classList.remove('recording');
}
function exIntro(it, inner) {
  const p = it.p;
  const recBtn = canRecord() ? h('button', { class: 'audio-btn rec', onclick: e => recordCompare(e.currentTarget, p.en) }, icon('mic'), h('span', null, 'Gravar e comparar')) : null;
  const chainBtn = TTS.ok && p.en.split(/\s+/).length >= 4 ? h('button', { class: 'audio-btn', title: 'Ouvir a frase montada do fim para o começo', onclick: e => backchain(p, e.currentTarget) }, icon('back'), h('span', null, 'Do fim ao começo')) : null;
  const reveal = h('button', { class: 'reveal' + (S.prefs.autoPt ? ' shown' : ''), 'aria-label': 'Mostrar tradução' }, h('div', { class: 'phrase-pt' }, p.pt));
  reveal.addEventListener('click', () => reveal.classList.add('shown'));
  const tags = h('div', { class: 'row' }, h('span', { class: 'tag-new' }, icon('star'), 'Frase nova'), h('span', { class: 'pill lv' }, p.level), h('span', { class: 'pill' }, p.topic));
  const show = () => {
    chainTok++;
    kids(inner,
      tags,
      phraseNode(p, { tap: true, focus: true }),
      audioButtons(p, [chainBtn, recBtn]),
      reveal,
      p.sound ? h('div', { class: 'sound-box' }, h('b', null, 'Na fala rápida: '), p.sound) : null,
      p.note ? h('div', { class: 'note-box' }, h('b', null, 'Entenda'), h('span', null, p.note)) : null,
      TTS.ok ? h('p', { class: 'small muted' }, 'Toque em uma palavra para ouvi-la. Repita a frase em voz alta duas vezes antes de continuar.') : null
    );
    foot(h('button', { class: 'btn big', id: 'mainBtn', onclick: () => { L.done++; nextItem(); } }, 'Continuar'));
    L.ex = { main: () => { L.done++; nextItem(); }, audio: () => sayP(p) };
    $('#mainBtn').focus({ preventScroll: true });
    sayP(p);
  };
  // Pretesting (generation effect): trying to produce the phrase before seeing it makes the later encoding
  // stronger, even when the guess is wrong (Potts & Shanks, 2014; Kornell, Hays & Bjork, 2009).
  const pretest = S.prefs.pretest && !it.retry && L.mode === 'unit';
  if (!pretest) { show(); return; }
  reveal.classList.add('shown');
  const guess = h('div', { class: 'guess' },
    h('p', { class: 'ex-hint', style: { marginTop: 0 } }, 'Antes de ver, tente: como você diria isso em ' + LANG.name + '? Pense ou fale em voz alta.'),
    h('div', { class: 'prompt-pt' }, p.pt),
    h('p', { class: 'small muted' }, 'Errar o palpite não tem problema: tentar primeiro faz a frase certa fixar melhor.'));
  kids(inner, tags, guess);
  foot(h('button', { class: 'btn big', id: 'mainBtn', onclick: show }, 'Revelar a frase'));
  L.ex = { main: show };
}

/* ---- choice exercises ---- */
function choiceEx(inner, it, prompt, options, correct, after) {
  const box = h('div', { class: 'options', role: 'list' });
  const btns = options.map((o, i) => {
    const b = h('button', { class: 'opt' + (it.type === 'read' ? ' en-opt' : ''), lang: it.type === 'read' ? LANG.code : null }, h('kbd', null, String(i + 1)), h('span', null, o));
    b.addEventListener('click', () => choose(i));
    put(box, b); return b;
  });
  function choose(i) {
    if (L.phase !== 'answer') return;
    const ok = options[i] === correct;
    btns.forEach((b, j) => { b.disabled = true; if (options[j] === correct) b.classList.add('right'); });
    if (!ok) btns[i].classList.add('wrong');
    after && after(ok);
    answer(ok, {});
  }
  put(inner, ...prompt, box);
  L.ex = { keys: k => { const n = +k; if (n >= 1 && n <= options.length) choose(n - 1); } };
}
function exListen(it, inner) {
  const p = it.p;
  const opts = shuffle([p.pt, ...distractors(p, 'pt')]);
  const big = h('button', { class: 'big-speaker', 'aria-label': 'Ouvir novamente' }, icon('speaker'));
  const play = slow => { big.classList.add('playing'); speak(p.en, { rate: slow ? Math.max(0.5, rateNow() * 0.7) : rateNow(), onend: () => big.classList.remove('playing') }); };
  big.addEventListener('click', () => play(false));
  const slow = h('button', { class: 'slow-btn', 'aria-label': 'Ouvir devagar', onclick: () => play(true) }, icon('slow'));
  choiceEx(inner, it, [...head('O que você ouviu?', 'Escolha o significado.'), h('div', { class: 'speaker-row' }, big, slow)], opts, p.pt);
  L.ex.audio = () => play(false);
  foot(h('button', { class: 'btn ghost', onclick: () => { it.type = 'read'; renderItem(); } }, 'Não posso ouvir agora'));
  play(false);
}
function exRead(it, inner) {
  const p = it.p;
  const opts = shuffle([p.en, ...distractors(p, 'en')]);
  choiceEx(inner, it, [...head('Como se diz em ' + LANG.name + '?'), h('div', { class: 'prompt-pt' }, p.pt)], opts, p.en);
  foot(h('p', { class: 'small muted' }, 'Escolha uma opção ou use as teclas 1 a 4.'));
}

/* ---- build (word tiles) ---- */
function exBuild(it, inner) {
  const p = it.p;
  const words = tilesOf(p);
  const have = new Set(words.map(w => w.toLowerCase()));
  const extra = [];
  for (const q of shuffle(ALL).slice(0, 40)) {
    for (const w of tilesOf(q)) { const lw = /^I($|')/.test(w) ? w : w.toLowerCase(); if (!have.has(lw.toLowerCase()) && /^[\p{L}']+$/u.test(lw) && lw.length > 1) { extra.push(lw); have.add(lw.toLowerCase()); break; } }
    if (extra.length >= (words.length > 9 ? 2 : 3)) break;
  }
  const bankWords = shuffle(words.map((w, i) => ({ w, k: 'r' + i })).concat(extra.map((w, i) => ({ w, k: 'x' + i }))));
  const line = h('div', { class: 'answer-line', 'aria-label': 'Sua resposta' });
  const bank = h('div', { class: 'bank' });
  const chosen = [];
  const check = h('button', { class: 'btn big', id: 'mainBtn', disabled: true, onclick: () => evaluate() }, 'Verificar');
  bankWords.forEach(t => {
    const b = h('button', { class: 'tile', lang: LANG.code }, t.w);
    t.btn = b;
    b.addEventListener('click', () => {
      if (L.phase !== 'answer' || b.classList.contains('ghosted')) return;
      b.classList.add('ghosted'); b.disabled = true;
      const a = h('button', { class: 'tile', lang: LANG.code }, t.w);
      a.addEventListener('click', () => { if (L.phase !== 'answer') return; a.remove(); chosen.splice(chosen.indexOf(t), 1); b.classList.remove('ghosted'); b.disabled = false; check.disabled = !chosen.length; });
      put(line, a); chosen.push(t); check.disabled = false; SFX.tick();
    });
    put(bank, b);
  });
  function evaluate() {
    if (L.phase !== 'answer' || !chosen.length) return;
    const user = chosen.map(t => t.w).join(' ');
    const ok = norm(user) === norm(words.join(' '));
    $$('.tile', inner).forEach(b => b.disabled = true);
    answer(ok, { user });
  }
  put(inner, ...head('Monte a frase em ' + LANG.name), h('div', { class: 'prompt-pt' }, p.pt), line, bank);
  foot(check);
  L.ex = { main: evaluate };
}

/* ---- cloze ---- */
function exCloze(it, inner) {
  const p = it.p, t = clozeTarget(p);
  const en = p.en.replace(/[’‘]/g, "'");
  const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Palavra que falta', enterkeyhint: 'done', lang: LANG.code });
  input.style.width = (Math.max(4, t.text.length) + 1.5) + 'ch';
  const sentence = h('div', { class: 'cloze', lang: LANG.code }, en.slice(0, t.i), input, en.slice(t.i + t.len));
  let hints = 0, hinted = false;
  const check = h('button', { class: 'btn big', id: 'mainBtn', disabled: true, onclick: () => evaluate() }, 'Verificar');
  const hintBtn = h('button', { class: 'btn ghost', onclick: () => { hints = Math.min(t.text.length - 1, hints + 1); hinted = true; input.value = t.text.slice(0, hints); input.focus(); check.disabled = false; } }, 'Dica');
  input.addEventListener('input', () => { check.disabled = !input.value.trim(); });
  function evaluate() {
    if (L.phase !== 'answer' || !input.value.trim()) return;
    const a = norm(input.value), b = norm(t.text);
    const typo = a !== b && near(a.replace(/ /g, ''), b.replace(/ /g, '')) === 1 && b.length >= 5;
    const ok = a === b || typo;
    input.disabled = true;
    answer(ok, { user: input.value, hint: hinted, typo: typo ? t.text : null });
  }
  put(inner, ...head('Complete a frase', 'Escreva o trecho que falta.'), sentence, h('p', { class: 'phrase-pt' }, p.pt));
  foot(hintBtn, check);
  L.ex = { main: evaluate, typing: true };
  setTimeout(() => input.focus({ preventScroll: true }), 60);
}

/* ---- typed: dictation / translation ---- */
function typedEx(it, inner, kind) {
  const p = it.p;
  const ta = h('textarea', { class: 'typearea', rows: '3', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', lang: LANG.code, placeholder: kind === 'dictation' ? 'Escreva em ' + LANG.name + ' o que ouviu' : 'Escreva em ' + LANG.name, 'aria-label': 'Sua resposta em ' + LANG.name });
  const check = h('button', { class: 'btn big', id: 'mainBtn', disabled: true, onclick: () => evaluate() }, 'Verificar');
  ta.addEventListener('input', () => { check.disabled = !ta.value.trim(); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); evaluate(); } });
  function evaluate() {
    if (L.phase !== 'answer' || !ta.value.trim()) return;
    // translation: another phrase of the course with the same meaning is also a correct answer
    const res = kind === 'dictation' ? align(p.en, ta.value) : bestAlign([p.en, ...synonymsEn(p)], ta.value);
    ta.disabled = true;
    answer(res.ok, { user: ta.value, res, override: true });
  }
  if (kind === 'dictation') {
    const big = h('button', { class: 'big-speaker', 'aria-label': 'Ouvir novamente' }, icon('speaker'));
    const play = slow => { big.classList.add('playing'); speak(p.en, { rate: slow ? Math.max(0.5, rateNow() * 0.7) : rateNow(), onend: () => big.classList.remove('playing') }); };
    big.addEventListener('click', () => { play(false); });
    const slow = h('button', { class: 'slow-btn', 'aria-label': 'Ouvir devagar', onclick: () => play(true) }, icon('slow'));
    put(inner, ...head('Escreva o que você ouvir', 'Ditado treina seu ouvido a separar as palavras na fala corrida.'), h('div', { class: 'speaker-row' }, big, slow), ta);
    L.ex = { main: evaluate, typing: true, audio: () => play(false) };
    foot(h('button', { class: 'btn ghost', onclick: () => { it.type = easier('dictation', p); renderItem(); } }, 'Não posso ouvir'), check);
    play(false);
  } else {
    put(inner, ...head('Traduza para o ' + LANG.name), h('div', { class: 'prompt-pt' }, p.pt), ta);
    L.ex = { main: evaluate, typing: true };
    foot(check);
  }
  setTimeout(() => ta.focus({ preventScroll: true }), 80);
}
const exDictation = (it, inner) => typedEx(it, inner, 'dictation');
const exTranslate = (it, inner) => typedEx(it, inner, 'translate');

/* ---- speaking ---- */
function speakEx(it, inner, shadow) {
  const p = it.p;
  let tries = 0;
  const heard = h('div', { class: 'heard', 'aria-live': 'polite' }, 'Toque no microfone e fale.');
  const mic = h('button', { class: 'mic-btn', 'aria-label': 'Falar' }, icon('mic'));
  const shown = h('div', { hidden: !shadow ? true : null });
  if (shadow) put(shown, h('p', { class: 'small muted' }, 'O texto aparece depois que você falar.'));
  mic.addEventListener('click', () => {
    if (L.phase !== 'answer') return;
    if (activeRec) { try { activeRec.stop(); } catch {} return; }
    stopSpeak();
    mic.classList.add('on'); heard.textContent = 'Ouvindo…';
    recognize({
      onInterim: t => { if (t) heard.textContent = '“' + t + '”'; },
      onError: err => {
        mic.classList.remove('on');
        if (err === 'not-allowed' || err === 'service-not-allowed') { S.prefs.mic = false; save(); toast('Microfone bloqueado. Liberei o exercício como tradução escrita.', 'err'); it.type = 'translate'; renderItem(); }
        else if (err === 'no-speech') heard.textContent = 'Não ouvi nada. Toque e fale mais perto do microfone.';
        else if (err === 'network') { heard.textContent = 'O reconhecimento de voz precisa de internet neste navegador.'; }
        else if (err !== 'aborted') heard.textContent = 'Não deu para ouvir. Tente de novo.';
      },
      onDone: alts => {
        mic.classList.remove('on');
        if (!alts.length) { heard.textContent = 'Não entendi. Tente de novo.'; return; }
        let best = null;
        const refs = shadow ? [p.en] : [p.en, ...synonymsEn(p)];
        for (const a of alts) { const r = bestAlign(refs, a); if (!best || r.score > best.score) best = { ...r, text: a }; }
        heard.textContent = '“' + best.text + '”';
        tries++;
        S.stats.speaks++;
        const ok = best.score >= 0.8;
        if (ok || tries >= 2) answer(ok, { user: best.text, res: best, override: true });
        else heard.textContent = '“' + best.text + '” — quase! Tente mais uma vez.';
      }
    });
  });
  if (shadow) {
    const big = h('button', { class: 'audio-btn', onclick: () => sayP(p) }, icon('speaker'), h('span', null, 'Ouvir'));
    const slow = h('button', { class: 'audio-btn', onclick: () => sayP(p, true) }, icon('slow'), h('span', null, 'Devagar'));
    put(inner, ...head('Ouça e repita', 'Imite o ritmo e a entonação.'), h('div', { class: 'audio-row' }, big, slow));
  } else {
    put(inner, ...head('Diga em ' + LANG.name, 'Fale a frase completa em voz alta.'), h('div', { class: 'prompt-pt' }, p.pt));
  }
  put(inner, h('div', { class: 'mic-wrap' }, mic, heard));
  foot(h('button', { class: 'btn ghost block', onclick: () => { micSnooze = Date.now() + 15 * 60e3; stopRec(); it.type = shadow ? 'dictation' : 'translate'; renderItem(); toast('Exercícios de fala pausados por 15 minutos.'); } }, 'Não posso falar agora'));
  L.ex = { audio: shadow ? () => sayP(p) : null };
  if (shadow) sayP(p);
}
const exSpeak = (it, inner) => speakEx(it, inner, false);
const exShadow = (it, inner) => speakEx(it, inner, true);

/* ---- answer & feedback ---- */
const PRAISE = ['Mandou bem!', 'Isso aí!', 'Perfeito!', 'Exato!', 'Excelente!', 'Muito bom!', 'Certinho!', 'Boa!'];
function answer(ok, info) {
  if (!L || L.phase !== 'answer') return;
  L.phase = 'feedback'; stopRec();
  const it = L.items[L.i], pc = L.per.get(it.p.id);
  const secs = (Date.now() - L.tItem) / 1000;
  S.stats.answers++; L.answered++;
  if (it.type === 'dictation') S.stats.dictations++;
  let gained = 0;
  if (ok) {
    S.stats.correct++; L.correct++; L.combo++; L.maxCombo = Math.max(L.maxCombo, L.combo); S.stats.maxCombo = Math.max(S.stats.maxCombo, L.combo);
    if (info.hint) pc.hint = true;
    if (PRODUCTIVE.has(it.type)) pc.hard = true;
    if (secs > 6 + it.p.en.split(/\s+/).length * 0.9) pc.slow = true;
    let base = L.combo >= 10 ? 20 : L.combo >= 5 ? 15 : 10;
    if (PRODUCTIVE.has(it.type)) base += 5;
    if (it.challenge) base += 10;
    if (['pair', 'mcq'].includes(it.type)) base = Math.round(base * 0.6);
    const critChance = L.combo >= 5 ? 0.1 : 0.06;
    if (it.type !== 'intro' && Math.random() < critChance) { info.crit = pick([2, 2, 3]); base *= info.crit; S.stats.crit = (S.stats.crit || 0) + 1; }
    gained = addXP(base); L.xp += gained; L.done++;
    if (info.crit) { SFX.crit(); buzz([15, 30, 15, 30, 40]); if (!reduceMotion()) confetti(50); } else { SFX.ok(L.combo); buzz(12); }
    questEvent('combo', L.combo, true);
    if (!remainingFor(it.p.id)) finalizeCard(it.p.id);
  } else {
    L.combo = 0; L.wrong++; pc.wrong++;
    SFX.bad(); buzz([25, 40, 25]);
    if (['pair', 'mcq'].includes(it.type)) { if (!it.retry) L.items.push({ type: it.type, p: it.p, retry: true }); else L.done++; }
    else if (pc.wrong < 3) L.items.push({ type: it.retry ? easier(it.type, it.p) : (it.type === 'speak' || it.type === 'shadow' ? 'translate' : it.type), p: it.p, retry: true });
    else L.done++;
    // no more attempts this session: record the lapse so the phrase comes back soon (FSRS "again")
    if (!remainingFor(it.p.id)) finalizeCard(it.p.id);
  }
  L.hist.push(ok ? 1 : 0);
  if (it.type === 'pair') pairStat(it.p, ok);
  questEvent('answer', 1);
  save(); updateCombo(); updateBar(); showSheet(ok, info, gained);
  checkAch();
}
function finalizeCard(id) {
  const pc = L.per.get(id); if (!pc || pc.fin) return; pc.fin = true;
  if (L.mode !== 'unit' && L.mode !== 'review' && L.mode !== 'practice') return;
  const c = S.cards[id];
  if (!c) { const g = pc.wrong === 0 ? 3 : pc.wrong === 1 ? 2 : 1; S.cards[id] = fsrsNew(g); S.newDay[today()] = (S.newDay[today()] || 0) + 1; }
  else {
    const g = pc.wrong > 0 ? 1 : pc.hint ? 2 : (pc.hard && !pc.slow) ? 4 : 3;
    S.cards[id] = fsrsReview(c, g); S.stats.reviews++;
  }
  bump();
}
function showSheet(ok, info, gained) {
  const it = L.items[L.i], p = it.p;
  const sh = $('#sheet');
  sh.className = 'sheet ' + (ok ? 'ok' : 'bad');
  const inner = h('div', { class: 'sheet-in' });
  const title = ok ? (info.typo || (info.res && info.res.typos) ? 'Quase perfeito!' : pick(PRAISE)) : 'Resposta correta:';
  put(inner, h('h3', null, icon(ok ? 'check' : 'close'), title, ok && gained ? h('span', { class: 'xp-pop' }, '+' + gained + ' XP') : null));
  if (info.crit) put(inner, h('span', { class: 'crit' }, icon('bolt'), 'Acerto crítico! XP ×' + info.crit));
  if (it.type === 'pair' || it.type === 'mcq') {
    if (!ok) put(inner, h('div', { class: 'answer', lang: it.type === 'pair' ? LANG.code : null }, p.en));
    if (it.type === 'pair') put(inner, h('div', { class: 'small' }, 'Compare: ', h('b', null, p.a), ' × ', h('b', null, p.b), '. ', p.tip || ''));
    if (it.type === 'mcq' && p.why) put(inner, h('div', { class: 'small' }, p.why));
    const acts2 = h('div', { class: 'sheet-acts' });
    if (it.type === 'pair' && TTS.ok) put(acts2, h('button', { class: 'btn ghost', 'aria-label': 'Ouvir os dois', onclick: () => playPairBoth(p) }, icon('speaker')));
    put(acts2, h('button', { class: 'btn ' + (ok ? 'ok' : 'bad'), id: 'contBtn', onclick: () => nextItem() }, 'Continuar'));
    put(inner, acts2);
    kids(sh, inner); sh.hidden = false;
    $('#lessonFoot').style.visibility = 'hidden';
    setTimeout(() => { const b = $('#contBtn'); b && b.focus({ preventScroll: true }); }, 30);
    if (it.type === 'pair' && TTS.ok) setTimeout(() => playPairBoth(p), 350);
    return;
  }
  const showAnswer = !ok || ['listen', 'dictation', 'translate', 'speak', 'shadow', 'cloze'].includes(it.type) || info.typo;
  if (showAnswer) put(inner, h('div', { class: 'answer', lang: LANG.code }, p.en));
  if (!ok || it.type === 'listen' || it.type === 'dictation' || it.type === 'shadow') put(inner, h('div', { class: 'small' }, p.pt));
  if (info.typo) put(inner, h('div', { class: 'small' }, 'Atenção à grafia: ', h('b', null, info.typo)));
  if (info.res && (info.res.typos || !ok)) {
    put(inner, h('div', { class: 'small muted' }, ok ? 'Pequenos erros de grafia destacados:' : 'Sua resposta:'), diffNode(info.res));
    if (!ok && info.res.missing.length) put(inner, h('div', { class: 'small' }, 'Faltou: ', h('b', null, info.res.missing.join(', '))));
  } else if (!ok && info.user) put(inner, h('div', { class: 'small muted' }, 'Você respondeu: ' + info.user));
  if (!ok && p.note) put(inner, h('div', { class: 'small' }, p.note));
  const acts = h('div', { class: 'sheet-acts' });
  if (TTS.ok) put(acts, h('button', { class: 'btn ghost', 'aria-label': 'Ouvir a frase', onclick: () => sayP(p) }, icon('speaker')));
  if (!ok && info.override) put(acts, h('button', { class: 'btn ghost', onclick: () => overrideAnswer() }, 'Eu acertei'));
  put(acts, h('button', { class: 'btn ' + (ok ? 'ok' : 'bad'), id: 'contBtn', onclick: () => nextItem() }, 'Continuar'));
  put(inner, acts);
  kids(sh, inner); sh.hidden = false;
  $('#lessonFoot').style.visibility = 'hidden';
  setTimeout(() => { const b = $('#contBtn'); b && b.focus({ preventScroll: true }); }, 30);
  if (ok && TTS.ok && ['read', 'build', 'cloze', 'translate'].includes(it.type)) sayP(p);
}
function overrideAnswer() {
  if (!L || L.phase !== 'feedback') return;
  const it = L.items[L.i], pc = L.per.get(it.p.id);
  const idx = L.items.length - 1;
  let popped = false;
  if (idx > L.i && L.items[idx] && L.items[idx].retry && L.items[idx].p.id === it.p.id) { L.items.pop(); popped = true; }
  pc.wrong = Math.max(0, pc.wrong - 1); pc.hint = true; L.wrong = Math.max(0, L.wrong - 1);
  S.stats.correct++; L.correct++;
  if (popped) L.done++; // otherwise the item was already counted as finished
  const g = addXP(10); L.xp += g;
  if (!remainingFor(it.p.id)) finalizeCard(it.p.id);
  save(); updateBar();
  showSheet(true, { user: '' }, g);
  toast('Resposta aceita. Vale anotar a versão de referência também.');
}
function nextItem() {
  if (!L) return;
  stopSpeak();
  $('#lessonFoot').style.visibility = '';
  L.i++;
  if (L.i >= L.items.length) finishLesson(); else renderItem();
}

/* ---- results, chest, streak ---- */
function finishLesson() {
  L.finished = true; L.phase = 'done'; $('#sheet').hidden = true;
  const secs = Math.round((Date.now() - L.t0) / 1000);
  S.stats.secs += secs; S.stats.lessons++;
  const perfect = L.wrong === 0 && L.answered > 0;
  let bonus = addXP(20); if (perfect) { bonus += addXP(30); S.stats.perfect++; }
  L.xp += bonus;
  L.coins = addCoins(5 + (perfect ? 5 : 0) + Math.floor(L.maxCombo / 10) * 2);
  const accR = L.answered ? L.correct / L.answered : 1;
  if (L.mode === 'unit' || L.mode === 'practice') questEvent('lesson', 1);
  if (L.mode === 'review' || L.mode === 'unit' || L.mode === 'practice') { const rv = new Set(L.items.filter(i => i.slot && L.per.get(i.p.id) && !L.per.get(i.p.id).isNew).map(i => i.p.id)).size; if (rv) questEvent('review', rv); }
  if (perfect && L.mode !== 'pairs' && L.mode !== 'text') questEvent('perfect', 1);
  if (L.mode === 'gym') questEvent('gym', 1);
  if (L.mode === 'pairs') { questEvent('pairs', 1); S.stats.pairRounds = (S.stats.pairRounds || 0) + 1; }
  if (L.onFinish) { try { L.onFinish(accR, L); } catch (e) { console.error(e); } }
  const streak = touchStreak();
  save(); bump(); checkAch();
  SFX.done(); confetti(perfect ? 180 : 110); buzz([20, 60, 20, 60, 40]);
  $('#combo').hidden = true;
  $('#lessonBar span').style.width = '100%';
  const acc = L.answered ? Math.round(L.correct * 100 / L.answered) : 100;
  const inner = $('#lessonInner');
  const chest = h('button', { class: 'chest', 'aria-label': 'Abrir o baú' }, icon('chest'));
  const reward = h('div', { class: 'reward', 'aria-live': 'polite' });
  const hintP = h('p', { class: 'small muted' }, 'Toque no baú para abrir sua recompensa.');
  const cont = h('button', { class: 'btn big', id: 'mainBtn', disabled: true, onclick: () => afterResult(streak) }, 'Continuar');
  let opened = false;
  const open = () => {
    if (opened) return; opened = true; chest.classList.add('open'); SFX.chest(); buzz(30);
    S.stats.chests++;
    const r = Math.random(); let msg;
    if (r < 0.06) { S.boostUntil = Date.now() + 15 * 60e3; msg = 'XP em dobro por 15 minutos!'; }
    else if (r < 0.16 && S.streak.freezes < 3) { S.streak.freezes++; msg = 'Protetor de sequência! Ele salva um dia perdido.'; }
    else if (r < 0.36) { const c = addCoins(10 + Math.floor(Math.random() * 21)); msg = '+' + c + ' moedas'; }
    else { const v = r < 0.6 ? 5 + Math.floor(Math.random() * 10) : r < 0.9 ? 15 + Math.floor(Math.random() * 15) : 40 + Math.floor(Math.random() * 30); const g = addXP(v); L.xp += g; msg = '+' + g + ' XP de bônus'; }
    reward.textContent = msg; hintP.remove(); save(); cont.disabled = false; cont.focus();
    if (!reduceMotion()) confetti(40);
  };
  chest.addEventListener('click', open);
  kids(inner, h('div', { class: 'result' },
    h('h1', null, perfect ? 'Lição perfeita!' : L.mode === 'gym' ? 'Treino concluído!' : 'Lição concluída!'),
    h('p', { class: 'muted' }, perfect ? 'Nenhum erro. Seu cérebro agradece a recuperação ativa.' : 'Os erros voltam mais tarde: é assim que a memória se fixa.'),
    h('div', { class: 'result-stats' },
      h('div', { class: 'rs a' }, h('span', null, 'XP'), h('b', null, '+' + L.xp)),
      h('div', { class: 'rs m' }, h('span', null, 'Precisão'), h('b', null, acc + '%')),
      h('div', { class: 'rs s' }, h('span', null, 'Tempo'), h('b', null, Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0')))),
    h('div', { class: 'coins' }, icon('coin'), '+' + L.coins + ' moedas'),
    chest, hintP, reward));
  foot(cont);
  L.ex = { main: () => { if (!opened) open(); else afterResult(streak); } };
}
function afterResult(streak) {
  if (L && pendingLevel && !L.levelShown) {
    L.levelShown = true; const lv = pendingLevel; pendingLevel = 0;
    SFX.level(); confetti(160); buzz([30, 50, 30, 50, 80]);
    kids($('#lessonInner'), h('div', { class: 'celebrate' }, icon('crown', 'ic big-ic'), h('p', { class: 'muted' }, 'Você subiu de nível'), h('div', { class: 'big-num' }, lv), h('p', null, 'Cada nível representa horas de prática real. Continue assim.')));
    foot(h('button', { class: 'btn big gold', id: 'mainBtn', onclick: () => afterResult(streak) }, 'Continuar'));
    L.ex = { main: () => afterResult(streak) };
    return;
  }
  if (L && pendingGoal && !L.goalShown) {
    L.goalShown = true; pendingGoal = false;
    SFX.done(); confetti(120);
    kids($('#lessonInner'), h('div', { class: 'celebrate' }, icon('target', 'ic big-ic'), h('h1', null, 'Meta diária cumprida!'), h('p', { class: 'muted' }, S.prefs.goal + ' XP hoje. Seu cérebro vai consolidar tudo isso durante o sono.')));
    foot(h('button', { class: 'btn big gold', id: 'mainBtn', onclick: () => afterResult(streak) }, 'Continuar'));
    L.ex = { main: () => afterResult(streak) };
    return;
  }
  if (streak && streak.extended && L && !L.streakShown) {
    L.streakShown = true;
    const inner = $('#lessonInner');
    kids(inner, h('div', { class: 'result' },
      h('div', { style: { color: 'var(--flame)' } }, icon('flame', 'ic streak-big')),
      h('h1', { class: 'tnum' }, streak.count + (streak.count === 1 ? ' dia seguido' : ' dias seguidos')),
      h('p', { class: 'muted' }, streak.saved ? 'Seu protetor de sequência salvou ' + streak.saved + (streak.saved > 1 ? ' dias.' : ' dia.') : streak.count === 1 ? 'Começou! Volte amanhã para manter a chama acesa.' : 'Estudar todo dia, mesmo pouco, rende mais que maratonas no fim de semana.'),
      weekDots()));
    const s = $('.streak-big'); if (s) { s.style.width = '96px'; s.style.height = '96px'; }
    foot(h('button', { class: 'btn big gold', id: 'mainBtn', onclick: () => afterResult(null) }, 'Continuar'));
    L.ex = { main: () => afterResult(null) };
    return;
  }
  // fluency plan: keep the flow going while today's quota of new phrases is not met
  const pl = planInfo();
  if (pl && L && !L.chainShown && (L.mode === 'unit' || L.mode === 'practice') && pl.todayNew < pl.perDay && nextUnit()) {
    L.chainShown = true;
    const nu = nextUnit();
    kids($('#lessonInner'), h('div', { class: 'celebrate' }, icon('target', 'ic big-ic'),
      h('h2', null, pl.todayNew + ' de ' + pl.perDay + ' frases novas hoje'),
      h('p', { class: 'muted' }, 'Seu plano de ' + pl.months + ' meses pede ' + pl.perDay + ' frases novas por dia. Faltam ' + (pl.perDay - pl.todayNew) + ' (cerca de ' + Math.max(1, Math.ceil((pl.perDay - pl.todayNew) / UNIT_SIZE)) + ' ' + ((pl.perDay - pl.todayNew) > UNIT_SIZE ? 'lições' : 'lição') + ').'),
      h('div', { class: 'bar amber', style: { width: '100%' } }, h('span', { style: { width: Math.min(100, Math.round(pl.todayNew * 100 / pl.perDay)) + '%' } })),
      h('p', { class: 'small muted' }, 'Emendar a próxima lição agora aproveita o aquecimento do cérebro; parar também vale: constância pesa mais que maratonas.')));
    foot(h('button', { class: 'btn ghost', onclick: () => afterResult(streak) }, 'Parar por hoje'),
      h('button', { class: 'btn big', id: 'mainBtn', onclick: () => { const items = buildUnitItems(nu); L = null; startLesson(items, { mode: 'unit', unit: nu, fromStage: true }); } }, 'Próxima lição'));
    L.ex = { main: () => { const items = buildUnitItems(nu); L = null; startLesson(items, { mode: 'unit', unit: nu, fromStage: true }); } };
    return;
  }
  closeLesson();
  flushQuestToasts();
}
function weekDots() {
  const wrap = h('div', { class: 'week' });
  const names = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const t = today();
  for (let i = 6; i >= 0; i--) {
    const k = keyAdd(t, -i); const d = new Date(k + 'T12:00:00');
    const on = (S.xpDay[k] || 0) > 0, fr = S.frozenDays.includes(k);
    put(wrap, h('div', null, h('i', { class: (on ? 'on' : fr ? 'frz' : '') + (i === 0 ? ' today' : '') }, on ? icon('flame') : fr ? icon('snow') : null), names[d.getDay()]));
  }
  return wrap;
}

/* =========================================================
   Views
   ========================================================= */
let TAB = 'home';
function go(tab) {
  if (tab === 'listen' || tab === 'library') { SUB = tab; tab = 'practice'; } else SUB = null;
  if (!['home', 'review', 'practice', 'quests', 'profile'].includes(tab)) tab = 'home';
  TAB = tab;
  try { history.replaceState(history.state, '', '#' + tab); } catch {}
  render(); window.scrollTo(0, 0);
}
function render() {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === TAB));
  const v = $('#view');
  const fn = { home: viewHome, review: viewReview, practice: viewPractice, quests: viewQuests, profile: viewProfile }[TAB] || viewHome;
  kids(v, fn());
  renderTop(); renderSide();
}
function renderTop() {
  const st = displayStreak();
  const sc = $('#topStreak'); sc.querySelector('b').textContent = st; sc.classList.toggle('cold', !(S.xpDay[today()] > 0));
  const pct = Math.min(100, Math.round(xpToday() * 100 / S.prefs.goal));
  const gc = $('#topGoal'); gc.querySelector('.mini-ring').style.setProperty('--p', pct); gc.querySelector('b').textContent = fmt(xpToday()); gc.setAttribute('aria-label', 'Meta diária: ' + xpToday() + ' de ' + S.prefs.goal + ' XP');
  const due = dueList().length; const b = $('#tabDue'); b.hidden = !due; b.textContent = due > 99 ? '99+' : due;
  const cc = $('#topCoins'); if (cc) cc.querySelector('b').textContent = fmt(S.coins);
  const qc = claimable(); const qb = $('#tabQuest'); if (qb) { qb.hidden = !qc; qb.textContent = qc; }
  for (const id of ['brandLang', 'railLang']) { const el = $('#' + id); if (el) { el.hidden = COURSE.id === 'en'; el.textContent = COURSE.short.toUpperCase(); el.title = COURSE.title; } }
}
function greeting() { const hr = new Date().getHours(); return hr < 5 ? 'Boa madrugada' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite'; }
function goalLine() {
  const x = xpToday(), g = S.prefs.goal;
  if (x >= g) return 'Meta de hoje cumprida. Cada lição extra é bônus.';
  const st = displayStreak();
  if (st > 0 && S.streak.last !== today()) return 'Sua sequência de ' + st + (st > 1 ? ' dias' : ' dia') + ' termina à meia-noite. Uma lição resolve.';
  return 'Faltam ' + fmt(g - x) + ' XP para a meta de hoje.';
}

/* ---- fluency plan: finish the whole course in N months ---- */
const newToday = () => S.newDay[today()] || 0;
function planInfo() {
  const months = S.plan && S.plan.months; if (!months || !S.plan.start) return null;
  const total = ALL.length, learned = learnedList().length, remaining = Math.max(0, total - learned);
  const days = Math.round(months * 30.44), elapsed = clamp(keyDiff(S.plan.start, today()), 0, days);
  const left = Math.max(1, days - elapsed);
  const perDay = remaining ? Math.max(UNIT_SIZE, Math.ceil(remaining / left / UNIT_SIZE) * UNIT_SIZE) : 0;
  // pace over the last 7 days, projected to the end of the course
  let last7 = 0; for (let i = 0; i < 7; i++) last7 += S.newDay[keyAdd(today(), -i)] || 0;
  const pace = last7 / 7;
  const etaDays = pace > 0 ? Math.ceil(remaining / pace) : null;
  const revs = dueList().length;
  const minutes = Math.round(perDay * 1.3 + Math.min(revs, 40) * 0.4);
  return { months, total, learned, remaining, days, elapsed, left, perDay, todayNew: newToday(), pace, etaDays, minutes, pct: total ? Math.round(learned * 100 / total) : 0 };
}
function planPanel() {
  const pl = planInfo(); if (!pl) return null;
  const done = pl.todayNew >= pl.perDay;
  const eta = pl.etaDays == null ? 'Comece hoje para calcularmos seu ritmo.' : pl.etaDays <= pl.left ? 'No ritmo dos últimos 7 dias você termina em ~' + Math.ceil(pl.etaDays / 30.44) + (pl.etaDays > 45 ? ' meses' : ' mês') + ', dentro do prazo.' : 'No ritmo atual você levaria ~' + Math.ceil(pl.etaDays / 30.44) + ' meses. Faça mais ' + Math.max(1, Math.ceil((pl.perDay - pl.pace) / UNIT_SIZE)) + ' lição(ões) por dia para voltar ao plano.';
  return h('section', { class: 'panel plan' },
    h('div', { class: 'panel-title' }, h('h3', null, 'Plano de ' + pl.months + ' meses'), h('span', { class: 'small muted tnum' }, fmt(pl.learned) + ' / ' + fmt(pl.total) + ' frases · ' + pl.pct + '%')),
    h('div', { class: 'bar mint' }, h('span', { style: { width: pl.pct + '%' } })),
    h('div', { class: 'row', style: { marginTop: '10px' } },
      h('div', { class: 'stat', style: { flex: 1 } }, h('b', { class: done ? 'ok-text' : '' }, pl.todayNew + ' / ' + pl.perDay), h('span', null, 'frases novas hoje')),
      h('div', { class: 'stat', style: { flex: 1 } }, h('b', null, '~' + pl.minutes), h('span', null, 'min por dia, com revisões')),
      h('div', { class: 'stat', style: { flex: 1 } }, h('b', null, pl.left), h('span', null, 'dias restantes'))),
    h('p', { class: 'small muted', style: { marginTop: '8px' } }, done ? 'Meta de frases novas de hoje cumprida. Revisões em dia valem ouro.' : eta));
}
function viewHome() {
  const page = h('div', { class: 'page' });
  put(page, h('div', { class: 'page-head' }, h('h1', null, greeting() + '!'), h('p', { class: 'muted' }, goalLine())));
  const nu = nextUnit(); const due = dueList().length;
  if (nu) {
    const fresh = nu.ph.filter(p => !S.cards[p.id]).length;
    const revs = Math.min(S.prefs.reviewMax, due);
    put(page, h('section', { class: 'continue' },
      h('div', { class: 'continue-meta' }, h('span', null, nu.level + ' · ' + LEVEL_NAME[nu.level]), h('span', null, unitTopics(nu)[0] || '')),
      h('h2', null, 'Lição ' + nu.n + ' de ' + nu.level),
      h('p', null, Math.min(fresh, S.prefs.newPer) + ' frases novas' + (revs ? ' + ' + revs + ' revisões' : '') + ' · cerca de ' + Math.max(3, Math.round((Math.min(fresh, S.prefs.newPer) * 3 + revs) * 0.3)) + ' min'),
      h('button', { class: 'btn big block', onclick: () => startLesson(buildUnitItems(nu), { mode: 'unit', unit: nu }) }, 'Começar lição'),
      due > 25 ? h('button', { class: 'btn text', style: { color: 'inherit', textDecoration: 'underline' }, onclick: () => go('review') }, due + ' revisões acumuladas: revise antes para não sobrecarregar a memória') : null));
  } else {
    put(page, h('section', { class: 'continue' }, h('h2', null, 'Você concluiu todas as lições!'), h('p', null, 'Agora o trabalho é manter: revisões diárias, ditados rápidos e muito ' + LANG.name + ' real.'), h('button', { class: 'btn big block', onclick: () => go('review') }, 'Ir para revisões')));
  }
  const plan = planPanel(); if (plan) put(page, plan);
  const gift = giftCard(); if (gift) put(page, gift);
  const hr = new Date().getHours();
  if (hr >= 20 && due > 0) put(page, h('div', { class: 'tip' }, icon('review'), h('span', null, 'Revisar um pouco antes de dormir ajuda: o cérebro consolida a memória durante o sono. ', h('button', { class: 'btn text', style: { minHeight: '0', padding: '0' }, onclick: () => go('review') }, 'Revisar agora'))));
  ensureQuests();
  const qd = S.quests.list.filter(x => x.done).length;
  put(page, h('button', { class: 'quest', style: { width: '100%', textAlign: 'left' }, onclick: () => go('quests') }, h('span', { class: 'qicon' }, icon('flag')),
    h('div', { style: { minWidth: 0 } }, h('b', null, 'Missões de hoje: ' + qd + ' de 3'), h('div', { class: 'bar amber' }, h('span', { style: { width: Math.round(qd * 100 / 3) + '%' } }))),
    h('span', { class: 'coins small' }, icon('coin'), fmt(S.coins))));
  put(page, dialPanel());
  put(page, pathSection(nu));
  return page;
}
function dialPanel() {
  const v = vocab();
  const max = 7000, pos = n => clamp(n / max * 100, 0, 100);
  const marks = [[1000, 'Conversa básica'], [3000, 'Séries com legenda'], [6000, 'Séries e rádio sem esforço']];
  const panel = h('section', { class: 'panel dial', 'aria-label': 'Seu vocabulário' });
  const scale = h('div', { class: 'dial-scale' }, h('div', { class: 'dial-ticks' }), h('div', { class: 'dial-fill', style: { width: pos(v.count) + '%' } }));
  marks.forEach(([n]) => put(scale, h('div', { class: 'dial-mark', style: { left: pos(n) + '%' } }, fmt(n))));
  put(scale, h('div', { class: 'dial-needle', style: { left: pos(v.count) + '%' }, title: fmt(v.count) + ' palavras' }));
  put(panel, 
    h('div', { class: 'dial-top' },
      h('div', null, h('div', { class: 'dial-pct' }, fmt(v.count)), h('div', { class: 'lbl' }, 'palavras-chave do ' + LANG.name + ' que você já reconhece')),
      h('div', { class: 'dial-side' }, h('div', { class: 'dial-pct' }, Math.round(v.cov * 100), h('small', null, '%')), h('div', { class: 'lbl' }, 'de um texto comum'))),
    scale,
    h('div', { class: 'dial-legend' }, ...marks.map(([n, t]) => h('div', { class: v.count >= n ? 'reached' : '' }, h('b', null, fmt(n) + ' palavras'), t))));
  return panel;
}
function pathSection(nu) {
  const sec = h('section', { class: 'page', style: { gap: '12px' } });
  if (!S.ui.level || !LEVELS.includes(S.ui.level)) S.ui.level = nu ? nu.level : S.startLevel;
  const lvl = S.ui.level;
  const seg = h('div', { class: 'seg', role: 'tablist' }, ...LEVELS.filter(Lv => LU[Lv].length).map(Lv => h('button', { class: Lv === lvl ? 'on' : '', role: 'tab', 'aria-selected': Lv === lvl ? 'true' : 'false', onclick: () => { S.ui.level = Lv; save(); render(); } }, Lv, h('small', null, levelPct(Lv) + '%'))));
  put(sec, h('div', { class: 'levelbar' }, h('h2', null, 'Trilha ' + lvl), h('span', { class: 'muted small' }, LEVEL_NAME[lvl] + ' · ' + LU[lvl].length + ' lições')), seg);
  const units = LU[lvl];
  if (!units.length) { put(sec, h('div', { class: 'panel empty' }, 'Sem lições neste nível.')); return sec; }
  if (!isUnlocked(units[0])) {
    put(sec, h('div', { class: 'panel', style: { display: 'grid', gap: '12px' } },
      h('h3', null, 'Nível ' + lvl + ' bloqueado'),
      h('p', { class: 'muted' }, 'Ele abre quando você concluir o nível anterior. Se você já tem esse nível, comece por aqui.'),
      h('button', { class: 'btn ghost', onclick: async () => { if (await confirmBox('Começar pelo ' + lvl + '?', 'Os níveis anteriores continuam disponíveis para praticar quando quiser.', 'Começar pelo ' + lvl)) { S.startLevel = lvl; save(); bump(); render(); } } }, 'Começar pelo ' + lvl)));
  }
  const parts = [];
  for (let i = 0; i < units.length; i += PART_SIZE) parts.push(units.slice(i, i + PART_SIZE));
  const narrow = innerWidth < 420;
  parts.forEach((pu, pi) => {
    const key = lvl + ':' + pi;
    const doneN = pu.filter(unitDone).length;
    const containsNext = nu && pu.includes(nu);
    const open = key in S.ui.open ? S.ui.open[key] : containsNext || (pi === 0 && !units.some(unitStarted) && !nu);
    const locked = !isUnlocked(pu[0]);
    const tps = {}; pu.forEach(u => u.ph.forEach(p => tps[p.topic] = (tps[p.topic] || 0) + 1));
    const tlist = Object.entries(tps).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]).join(', ');
    const wrap = h('div', { class: 'part' + (locked ? ' locked' : '') });
    put(wrap, h('button', { class: 'part-head', 'aria-expanded': open ? 'true' : 'false', onclick: () => { S.ui.open[key] = !open; save(); render(); } },
      h('div', { style: { minWidth: 0 } }, h('div', { class: 'pt-title' }, 'Parte ' + (pi + 1)), h('div', { class: 'pt-sub' }, tlist)),
      doneN === pu.length ? h('span', { class: 'pill ok' }, icon('check', 'ic'), 'Feita') : h('span', { class: 'small muted tnum' }, locked ? 'Bloqueada' : doneN + ' de ' + pu.length),
      doneN && doneN < pu.length ? h('div', { class: 'bar amber' }, h('span', { style: { width: Math.round(doneN * 100 / pu.length) + '%' } })) : null));
    if (open) {
      const path = h('div', { class: 'path' });
      pu.forEach((u, i) => {
        const dn = unitDone(u), ul = isUnlocked(u), cur = nu === u;
        const gold = dn && u.ph.every(p => S.cards[p.id] && S.cards[p.id].s >= 21);
        const x = Math.round(Math.sin((u.n - 1) * 0.95) * (narrow ? 56 : 80));
        const node = h('button', { class: 'node' + (gold ? ' done gold' : dn ? ' done' : ul ? ' open' : '') + (cur ? ' current' : ''), style: { '--x': x + 'px' }, 'aria-label': 'Lição ' + u.n + (gold ? ', dominada' : dn ? ', concluída' : ul ? '' : ', bloqueada'), onclick: () => unitSheet(u) },
          icon(gold ? 'crown' : dn ? 'check' : ul ? 'star' : 'lock'), h('span', { class: 'num' }, u.n), cur ? h('span', { class: 'node-tip' + (x > 0 ? ' left' : '') }, 'Começar') : null);
        put(path, node);
      });
      put(wrap, path);
    }
    put(sec, wrap);
  });
  return sec;
}
function unitSheet(u) {
  const dn = unitDone(u), ul = isUnlocked(u);
  const list = h('ul');
  u.ph.forEach(p => put(list, h('li', null, S.cards[p.id] ? icon('check', 'ic') : h('span', { class: 'muted' }, '•'), h('span', null, h('span', { lang: LANG.code }, ul ? p.en : '· · ·'), S.cards[p.id] ? h('span', { class: 'muted' }, ' — ' + p.pt) : null))));
  openModal([
    h('div', { class: 'row' }, h('span', { class: 'pill lv' }, u.level), h('span', { class: 'pill' }, unitTopics(u).join(', '))),
    h('h2', null, 'Lição ' + u.n + ' de ' + u.level),
    dn ? (() => { const m = u.ph.filter(p => S.cards[p.id] && S.cards[p.id].s >= 21).length; return h('p', { class: 'muted small' }, m === u.ph.length ? 'Lição de ouro: todas as frases estão na memória de longo prazo.' : m + ' de ' + u.ph.length + ' frases dominadas. Domine todas nas revisões para a lição virar ouro.'); })() : null,
    h('div', { class: 'unit-phrases' }, list),
    h('div', { class: 'acts' },
      ul ? h('button', { class: 'btn big block', onclick: () => { closeModal(); startLesson(dn ? buildPracticeItems(u.ph) : buildUnitItems(u), { mode: dn ? 'practice' : 'unit', unit: u }); } }, dn ? 'Praticar de novo' : unitStarted(u) ? 'Continuar lição' : 'Começar lição')
        : h('p', { class: 'muted' }, 'Conclua a lição anterior para desbloquear esta.'),
      h('button', { class: 'btn ghost block', onclick: closeModal }, 'Fechar'))
  ]);
}

function viewReview() {
  const page = h('div', { class: 'page' });
  const due = dueList();
  const learned = learnedList().length;
  put(page, h('div', { class: 'page-head' }, h('h1', null, 'Revisar'), h('p', { class: 'muted' }, 'Cada frase volta no dia em que você está prestes a esquecê-la. Lembrar com esforço é o que fixa.')));
  const mastered = learnedList().filter(p => S.cards[p.id].s >= 21).length;
  put(page, h('div', { class: 'stats four' },
    h('div', { class: 'stat' }, h('b', null, fmt(due.length)), h('span', null, 'para hoje')),
    h('div', { class: 'stat' }, h('b', null, fmt(learned)), h('span', null, 'frases aprendidas')),
    h('div', { class: 'stat' }, h('b', null, fmt(mastered)), h('span', null, 'dominadas (21+ dias)')),
    h('div', { class: 'stat' }, h('b', null, S.stats.answers ? Math.round(S.stats.correct * 100 / S.stats.answers) + '%' : '—'), h('span', null, 'acertos no total'))));
  if (due.length) {
    const n = Math.min(15, due.length);
    put(page, h('section', { class: 'continue' },
      h('h2', null, due.length + (due.length === 1 ? ' revisão espera' : ' revisões esperam') + ' por você'),
      h('p', null, 'Sessão de ' + n + ' frases com exercícios que ficam mais difíceis conforme a memória fica mais forte.'),
      h('button', { class: 'btn big block', onclick: () => startLesson(due.slice(0, n).map(p => mk(reviewType(p, S.cards[p.id]), p)), { mode: 'review' }) }, 'Revisar ' + n + ' frases')));
  } else {
    put(page, h('div', { class: 'panel empty' }, h('h2', null, 'Tudo em dia'),
      h('p', { class: 'muted' }, learned ? 'Nenhuma revisão vence hoje. Quer reforçar as frases mais frágeis?' : 'Faça sua primeira lição na trilha e as revisões aparecem aqui.'),
      learned ? h('button', { class: 'btn', onclick: () => { const weak = learnedList().slice().sort((a, b) => retrievability(S.cards[a.id]) - retrievability(S.cards[b.id])).slice(0, 10); startLesson(buildPracticeItems(weak), { mode: 'practice' }); } }, 'Treinar as 10 mais frágeis') : h('button', { class: 'btn', onclick: () => go('home') }, 'Ir para a trilha')));
  }
  // forecast
  const days = [], start = dayStart();
  for (let i = 0; i < 7; i++) days.push(0);
  for (const c of Object.values(S.cards)) { const k = Math.floor((Math.max(c.due, start) - start) / DAY); if (k >= 0 && k < 7) days[k]++; }
  const mx = Math.max(1, ...days);
  const names = ['Hoje', 'Amanhã'];
  put(page, h('section', { class: 'panel' }, h('div', { class: 'panel-title' }, h('h3', null, 'Próximos 7 dias'), h('span', { class: 'small muted' }, 'revisões previstas')),
    h('div', { class: 'weekbars' }, ...days.map((n, i) => { const d = new Date(start + i * DAY + 12 * 3600e3); return h('div', { class: i === 0 ? 'today' : '' }, h('em', null, n), h('i', { style: { height: Math.round(n / mx * 80) + '%' } }), names[i] || d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')); }))));
  put(page, h('p', { class: 'small muted' }, 'Algoritmo FSRS com meta de ' + Math.round(S.prefs.retention * 100) + '% de lembrança (ajustável no Perfil). Erros encurtam o intervalo; acertos rápidos e sem dica o ampliam.'));
  return page;
}

/* ---- listening hub ---- */
const REDUCTIONS_EN = [
  ['going to + verbo', 'gonna', "I'm gonna call you later."], ['want to', 'wanna', 'Do you wanna grab a coffee?'], ['got to / have got to', 'gotta', 'I gotta go.'],
  ['have to', 'hafta', 'I hafta work tomorrow.'], ['kind of', 'kinda', "I'm kinda tired."], ['sort of', 'sorta', "It's sorta weird."], ['out of', 'outta', 'Get outta here!'],
  ['a lot of', 'a lotta', 'We have a lotta work.'], ['let me', 'lemme', 'Lemme check.'], ['give me', 'gimme', 'Gimme a second.'], ["don't know", 'dunno', 'I dunno.'],
  ['did you', 'didja', 'Didja see that?'], ['what are you', 'whatcha', 'Whatcha doing?'], ['would you / could you', 'wouldja / couldja', 'Couldja help me?'],
  ['should have / could have', 'shoulda / coulda', 'I shoulda known.'], ['because', "'cause", "I left 'cause it was late."], ['them', "'em", "Tell 'em I said hi."],
  ['probably', 'prolly', "I'll prolly be late."], ['you all', "y'all", "Are y'all ready?"],
  ['T entre vogais', 'water → “wáder”', 'better, a lot of, get it: o T vira um D rápido no inglês americano.'],
  ['T antes de N', 'button → “bâ’n”', 'important, mountain, certain: o T quase some, vira uma pausa na garganta.'],
  ['Palavras ligadas', 'turn it off → “tur-ni-doff”', 'Consoante final se liga à vogal seguinte: pick it up, look at it, get out of.']
];
const IMMERSION_TIPS_EN = {
  A1: ['Vídeos curtos com legenda em inglês sobre rotina e viagem.', 'Podcasts para iniciantes com fala lenta.', 'Ouça as frases do app no Modo rádio enquanto caminha.'],
  A2: ['Séries leves com legenda em inglês (sitcoms dos anos 90 e 2000).', 'Podcasts para estudantes com transcrição.', 'Reassista um episódio que você já conhece.'],
  B1: ['Sitcoms com legenda em inglês, sem português.', 'YouTubers americanos sobre temas que você já gosta.', 'Podcasts com transcrição: leia depois de ouvir.'],
  B2: ['Séries e filmes sem legenda em português.', 'Podcasts nativos sobre seus interesses.', 'Rádio de notícias por 10 minutos por dia.'],
  C1: ['Rádio e podcasts nativos em velocidade normal.', 'Talk shows, stand-up e debates.', 'Livros em inglês com audiobook ao mesmo tempo.'],
  C2: ['Sotaques variados: sul dos EUA, Reino Unido, Austrália, Índia.', 'Comédia e sátira, onde o humor depende de ironia e subentendidos.', 'Escreva textos longos e peça a um nativo para comentar o estilo.']
};
const Radio = { on: false, list: [], i: 0, tok: 0, cur: null };
function radioSource() {
  let src = learnedList().slice();
  if (S.ui.radioSrc === 'due') src = dueList().slice();
  if (!src.length) { const nu = nextUnit(); src = nu ? nu.ph.slice() : ALL.slice(0, 20); }
  return shuffle(src).slice(0, 200);
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function radioLoop(tok) {
  while (Radio.on && tok === Radio.tok) {
    if (Radio.i >= Radio.list.length) { Radio.list = radioSource(); Radio.i = 0; }
    const p = Radio.list[Radio.i]; Radio.cur = p; paintRadio();
    const rate = S.ui.gymRate || 1;
    await speakP(p.en, { rate }); if (tok !== Radio.tok) return;
    await wait(900); if (tok !== Radio.tok) return;
    if (S.ui.radioPt && TTS.pt) { await speakP(p.pt, { lang: 'pt', rate: 1.05 }); if (tok !== Radio.tok) return; await wait(700); }
    for (let r = 1; r < S.ui.radioRep; r++) { await speakP(p.en, { rate }); if (tok !== Radio.tok) return; await wait(1200); }
    await wait(1300);
    Radio.i++;
  }
}
function startRadio() { if (!TTS.ok) { toast('Este navegador não tem síntese de voz.', 'err'); return; } Radio.on = true; Radio.tok++; Radio.list = radioSource(); Radio.i = 0; radioLoop(Radio.tok); paintRadio(); }
function stopRadio() { if (!Radio.on) return; Radio.on = false; Radio.tok++; stopSpeak(); paintRadio(); }
function paintRadio() {
  const box = $('#radioNow'); if (!box) return;
  const p = Radio.cur;
  kids(box, p ? h('div', { class: 'phrase-en', style: { fontSize: 'clamp(22px,5vw,30px)' }, lang: LANG.code }, p.en) : h('p', { class: 'muted' }, 'Toque em tocar para ouvir suas frases em sequência, com pausas para repetir.'), p ? h('div', { class: 'phrase-pt', style: { fontSize: '17px' } }, p.pt) : null);
  const b = $('#radioPlay'); if (b) { kids(b, icon(Radio.on ? 'pause' : 'play'), h('span', null, Radio.on ? 'Pausar' : 'Tocar')); }
}
function viewListen() {
  const page = h('div', { class: 'page' });
  put(page, subHead('Treino de escuta', 'Para entender nativos, o ouvido precisa de treino próprio: separar palavras na fala corrida, reconhecer reduções e aguentar a velocidade real.'));
  const rates = [[0.85, 'Calmo'], [1, 'Normal'], [1.15, 'Nativo'], [1.3, 'Rápido']];
  put(page, h('div', { class: 'seg', 'aria-label': 'Velocidade' }, ...rates.map(([r, t]) => h('button', { class: S.ui.gymRate === r ? 'on' : '', onclick: () => { S.ui.gymRate = r; save(); render(); } }, t, h('small', null, r.toFixed(2).replace(/0$/, '') + '×')))));
  const gym = gymStart;
  const tools = h('div', { class: 'tool-grid' },
    h('button', { class: 'tool', onclick: () => gym('dictation', 'Ditado') }, icon('ear'), h('b', null, 'Ditado'), h('span', null, '10 frases: ouça e escreva tudo o que ouviu.')),
    h('button', { class: 'tool', onclick: () => gym('listen', 'Entender de ouvido') }, icon('speaker'), h('b', null, 'Entender de ouvido'), h('span', null, '10 frases só em áudio. Escolha o significado.')),
    SRC ? h('button', { class: 'tool', onclick: () => gym('shadow', 'Ouça e repita') }, icon('mic'), h('b', null, 'Ouça e repita'), h('span', null, 'Shadowing: imite o ritmo, o app confere a pronúncia.')) : null);
  put(page, tools);
  if (!TTS.ok) put(page, h('div', { class: 'panel' }, 'Este navegador não oferece síntese de voz. Use Chrome, Edge ou Safari atualizados.'));
  // radio
  const radio = h('section', { class: 'panel radio' },
    h('div', { class: 'panel-title' }, h('h3', null, 'Modo rádio'), h('span', { class: 'small muted' }, 'mãos livres')),
    h('div', { class: 'radio-now', id: 'radioNow', 'aria-live': 'polite' }),
    h('div', { class: 'radio-ctrl' },
      h('button', { class: 'btn', id: 'radioPlay', onclick: () => Radio.on ? stopRadio() : startRadio() }),
      h('button', { class: 'btn ghost', 'aria-label': 'Próxima frase', onclick: () => { if (!Radio.on) return; Radio.i++; Radio.tok++; stopSpeak(); const t = Radio.tok; radioLoop(t); } }, icon('next'))),
    h('div', { class: 'set' }, h('div', null, h('b', null, 'Tradução falada'), h('span', null, TTS.pt ? LANG.Name + ', português, ' + LANG.name + ' de novo.' : 'Nenhuma voz em português encontrada.')), toggle(S.ui.radioPt, v => { S.ui.radioPt = v; save(); })),
    h('div', { class: 'set' }, h('div', null, h('b', null, 'Repetições em ' + LANG.name), h('span', null, 'Quantas vezes cada frase toca.')),
      h('select', { class: 'input', style: { width: 'auto' }, onchange: e => { S.ui.radioRep = +e.target.value; save(); } }, ...[1, 2, 3].map(n => h('option', { value: n, selected: S.ui.radioRep === n }, n + '×')))),
    h('div', { class: 'set' }, h('div', null, h('b', null, 'Frases'), h('span', null, 'O que tocar.')),
      h('select', { class: 'input', style: { width: 'auto' }, onchange: e => { S.ui.radioSrc = e.target.value; save(); if (Radio.on) { stopRadio(); startRadio(); } } },
        h('option', { value: 'learned', selected: S.ui.radioSrc === 'learned' }, 'Aprendidas'), h('option', { value: 'due', selected: S.ui.radioSrc === 'due' }, 'Revisões de hoje'))));
  put(page, radio);
  setTimeout(paintRadio, 0);
  // reductions
  if (!LANG.reductions.length) return page;
  const red = h('section', { class: 'panel' }, h('div', { class: 'panel-title' }, h('h3', null, 'Como os nativos falam de verdade'), h('span', { class: 'small muted' }, COURSE.title.toLowerCase())),
    h('p', { class: 'muted small', style: { marginBottom: '6px' } }, 'Na fala rápida, palavras se fundem. Quem só conhece a forma escrita não reconhece o som. Conheça as reduções mais comuns:'));
  LANG.reductions.forEach(([from, to, ex]) => put(red, h('div', { class: 'reduction' },
    h('div', null, h('div', { class: 'from' }, from), h('div', { class: 'to', lang: LANG.code }, to)),
    TTS.ok && !ex.includes(':') ? h('button', { class: 'icon-btn', 'aria-label': 'Ouvir exemplo', onclick: () => speak(ex, { rate: S.ui.gymRate }) }, icon('speaker')) : h('span'),
    h('div', { class: 'ex', lang: ex.includes(':') ? 'pt-BR' : LANG.code }, ex))));
  put(page, red);
  return page;
}
function touchStreakSoft() { const r = touchStreak(); if (r.extended) toast(r.count + (r.count > 1 ? ' dias seguidos!' : ' dia seguido!'), 'ach', 'flame'); }

/* ---- library ---- */
let libLimit = 40, libQuery = '', libTimer = 0;
function viewLibrary() {
  const page = h('div', { class: 'page' });
  put(page, subHead('Todas as frases', fmt(ALL.length) + ' frases do curso. Pesquise em ' + LANG.name + ' ou português.'));
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Ex.: I wish, viagem, trabalho', value: libQuery, 'aria-label': 'Pesquisar frases', autocomplete: 'off', id: 'libSearch' });
  const lvSel = h('select', { class: 'input', 'aria-label': 'Nível', id: 'libLevel' }, h('option', { value: 'all' }, 'Todos os níveis'), ...LEVELS.map(Lv => h('option', { value: Lv, selected: S.ui.libLevel === Lv }, Lv + ' · ' + LEVEL_NAME[Lv])));
  const stSel = h('select', { class: 'input', 'aria-label': 'Situação', id: 'libStatus' }, ...[['all', 'Todas'], ['new', 'Ainda não estudadas'], ['learned', 'Aprendidas'], ['mastered', 'Dominadas'], ['hard', 'Difíceis para mim'], ['due', 'Para revisar hoje']].map(([v, t]) => h('option', { value: v, selected: S.ui.libStatus === v }, t)));
  const count = h('p', { class: 'small muted' });
  const list = h('div', { class: 'list' });
  const more = h('button', { class: 'btn ghost', onclick: () => { libLimit += 60; fill(); } }, 'Mostrar mais');
  function fill() {
    const qq = norm(libQuery), lv = S.ui.libLevel, st = S.ui.libStatus;
    const dueSet = new Set(dueList().map(p => p.id));
    const res = ALL.filter(p => {
      if (lv !== 'all' && p.level !== lv) return false;
      const c = S.cards[p.id];
      if (st === 'new' && c) return false;
      if (st === 'learned' && !c) return false;
      if (st === 'mastered' && !(c && c.s >= 21)) return false;
      if (st === 'hard' && !(c && (c.l >= 2 || c.d >= 7.5))) return false;
      if (st === 'due' && !dueSet.has(p.id)) return false;
      return !qq || p._s.includes(qq);
    });
    count.textContent = fmt(res.length) + (res.length === 1 ? ' frase' : ' frases');
    kids(list, ...res.slice(0, libLimit).map(itemRow));
    if (!res.length) put(list, h('div', { class: 'empty muted' }, 'Nenhuma frase com esses filtros.'));
    more.hidden = res.length <= libLimit;
  }
  q.addEventListener('input', () => { clearTimeout(libTimer); libTimer = setTimeout(() => { libQuery = q.value; libLimit = 40; fill(); }, 150); });
  lvSel.addEventListener('change', () => { S.ui.libLevel = lvSel.value; libLimit = 40; save(); fill(); });
  stSel.addEventListener('change', () => { S.ui.libStatus = stSel.value; libLimit = 40; save(); fill(); });
  put(page, h('div', { style: { display: 'grid', gap: '10px' } }, q, h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px' } }, lvSel, stSel)), count, list, more);
  fill();
  return page;
}
function itemRow(p) {
  const c = S.cards[p.id];
  let status = h('span', { class: 'pill' }, 'Nova');
  if (c) { const days = Math.round((c.due - dayStart()) / DAY); status = h('span', { class: 'pill ' + (c.s >= 21 ? 'ok' : 'warn') }, c.s >= 21 ? 'Dominada' : days <= 0 ? 'Revisar hoje' : 'Revisão em ' + days + (days === 1 ? ' dia' : ' dias')); }
  const row = h('div', { class: 'item' },
    h('div', { style: { minWidth: 0 } }, h('div', { class: 'en', lang: LANG.code }, p.en), h('div', { class: 'pt' }, p.pt),
      h('div', { class: 'meta' }, h('span', { class: 'pill lv' }, p.level), h('span', { class: 'pill' }, p.topic), status)),
    h('div', { class: 'acts' }, TTS.ok ? h('button', { class: 'icon-btn', 'aria-label': 'Ouvir', onclick: () => speak(p.en) }, icon('speaker')) : null));
  if (p.note || p.sound) put(row, h('details', null, h('summary', null, 'Explicação'), p.note ? h('p', null, p.note) : null, p.sound ? h('p', null, h('b', null, 'Na fala rápida: '), p.sound) : null));
  return row;
}

/* ---- profile & settings ---- */
function toggle(val, on) {
  const inp = h('input', { type: 'checkbox', role: 'switch' }); inp.checked = !!val;
  inp.addEventListener('change', () => on(inp.checked));
  return h('label', { class: 'switch' }, inp, h('i'));
}
function setRow(title, sub, ctrl) { return h('div', { class: 'set' }, h('div', null, h('b', null, title), sub ? h('span', null, sub) : null), ctrl); }
let themeSet = false;
function applyTheme() {
  const t = S.prefs.theme;
  if (t === 'auto') { if (themeSet) document.documentElement.removeAttribute('data-theme'); themeSet = false; }
  else { document.documentElement.setAttribute('data-theme', t); themeSet = true; }
}
function viewProfile() {
  const page = h('div', { class: 'page' });
  const lvl = playerLevel(S.xp), lo = levelFloor(lvl), hi = levelFloor(lvl + 1);
  put(page, h('div', { class: 'page-head' }, h('h1', null, 'Perfil'),
    h('div', { class: 'panel', style: { display: 'grid', gap: '10px' } },
      h('div', { class: 'row' }, h('div', { class: 'goal-ring', style: { '--p': Math.round((S.xp - lo) * 100 / (hi - lo)) } }, h('span', null, 'Nv ' + lvl)),
        h('div', { class: 'grow' }, h('b', null, 'Nível ' + lvl), h('div', { class: 'small muted tnum' }, fmt(S.xp - lo) + ' / ' + fmt(hi - lo) + ' XP para o nível ' + (lvl + 1)),
          h('div', { class: 'bar amber', style: { marginTop: '6px' } }, h('span', { style: { width: Math.round((S.xp - lo) * 100 / (hi - lo)) + '%' } })))),
      Date.now() < S.boostUntil ? h('span', { class: 'pill warn' }, icon('bolt'), 'XP em dobro ativo') : null,
      h('button', { class: 'btn ghost', onclick: shareProgress }, icon('share'), 'Compartilhar meu progresso'))));
  const acc = S.stats.answers ? Math.round(S.stats.correct * 100 / S.stats.answers) + '%' : '—';
  put(page, h('div', { class: 'stats four' },
    h('div', { class: 'stat' }, h('b', null, displayStreak()), h('span', null, 'dias seguidos (recorde ' + (S.streak.best || 0) + ')')),
    h('div', { class: 'stat' }, h('b', null, fmt(S.xp)), h('span', null, 'XP total')),
    h('div', { class: 'stat' }, h('b', null, fmt(learnedList().length)), h('span', null, 'frases aprendidas')),
    h('div', { class: 'stat' }, h('b', null, acc), h('span', null, 'acertos')),
    h('div', { class: 'stat' }, h('b', null, fmt(vocab().count)), h('span', null, 'palavras reconhecidas')),
    h('div', { class: 'stat' }, h('b', null, S.streak.freezes), h('span', null, 'protetores de sequência')),
    h('div', { class: 'stat' }, h('b', null, fmt(Math.round(S.stats.secs / 60))), h('span', null, 'minutos no app')),
    h('div', { class: 'stat' }, h('b', null, fmt(immTotal())), h('span', null, 'minutos de ' + LANG.name + ' real'))));
  // week xp
  const t = today(); const days = [];
  for (let i = 6; i >= 0; i--) days.push(keyAdd(t, -i));
  const mx = Math.max(S.prefs.goal, ...days.map(k => S.xpDay[k] || 0));
  put(page, h('section', { class: 'panel' }, h('div', { class: 'panel-title' }, h('h3', null, 'XP da semana'), h('span', { class: 'small muted' }, 'meta ' + S.prefs.goal + ' XP/dia')),
    h('div', { class: 'weekbars' }, ...days.map((k, i) => { const v = S.xpDay[k] || 0; const d = new Date(k + 'T12:00:00'); return h('div', { class: i === 6 ? 'today' : '' }, h('em', null, v), h('i', { style: { height: Math.round(v / mx * 80) + '%' } }), d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')); }))));
  // achievements
  const got = ACH.filter(a => S.ach[a.id]).length;
  put(page, candoPanel());
  put(page, h('section', { class: 'page', style: { gap: '10px' } }, h('div', { class: 'levelbar' }, h('h2', null, 'Conquistas'), h('span', { class: 'small muted' }, got + ' de ' + ACH.length)),
    h('div', { class: 'badges' }, ...ACH.map(a => h('div', { class: 'badge' + (S.ach[a.id] ? ' got' : '') }, h('div', { class: 'medal' }, icon(S.ach[a.id] ? 'star' : 'lock')), h('div', { style: { minWidth: 0 } }, h('b', null, a.t), h('span', null, a.d)))))));
  // settings
  const voiceSel = h('select', { class: 'input', id: 'voiceSel', 'aria-label': 'Voz em ' + LANG.name }, h('option', { value: '' }, 'Automática (melhor disponível)'), ...TTS.list.map(v => h('option', { value: v.voiceURI, selected: v.voiceURI === S.prefs.voice }, v.name + ' · ' + v.lang)));
  voiceSel.addEventListener('change', () => { S.prefs.voice = voiceSel.value; save(); loadVoices(); speak('Hi! This is how I sound.'); });
  const rate = h('input', { type: 'range', class: 'range', min: '0.7', max: '1.2', step: '0.05', value: String(S.prefs.rate), 'aria-label': 'Velocidade da voz', id: 'rateIn' });
  const rateLbl = h('span', { class: 'tnum' }, S.prefs.rate.toFixed(2) + '×');
  rate.addEventListener('input', () => { S.prefs.rate = +rate.value; rateLbl.textContent = S.prefs.rate.toFixed(2) + '×'; save(); });
  rate.addEventListener('change', () => speak('Can you hear the difference?'));
  const theme = h('div', { class: 'seg' }, ...[['auto', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, tx]) => h('button', { class: S.prefs.theme === v ? 'on' : '', onclick: () => { S.prefs.theme = v; applyTheme(); save(); render(); } }, tx)));
  const sel = (id, val, opts, on) => { const s = h('select', { class: 'input', id, style: { width: 'auto', maxWidth: '100%' } }, ...opts.map(([v, tx]) => h('option', { value: v, selected: String(val) === String(v) }, tx))); s.addEventListener('change', () => on(s.value)); return s; };
  put(page, h('section', { class: 'panel' }, h('h3', { style: { marginBottom: '6px' } }, 'Estudo'),
    setRow('Meta diária', 'Quanto XP você quer ganhar por dia.', sel('goalSel', S.prefs.goal, [[150, 'Leve · 150 XP (~5 min)'], [300, 'Regular · 300 XP (~10 min)'], [600, 'Sério · 600 XP (~20 min)'], [1000, 'Intenso · 1.000 XP (~35 min)']], v => { S.prefs.goal = +v; save(); renderTop(); renderSide(); })),
    setRow('Frases novas por lição', 'Menos frases novas, mais fixação.', sel('newSel', S.prefs.newPer, [[3, '3'], [4, '4'], [5, '5']], v => { S.prefs.newPer = +v; save(); })),
    setRow('Revisões dentro das lições', 'Misturar revisões com conteúdo novo melhora a retenção.', sel('revSel', S.prefs.reviewMax, [[0, 'Nenhuma'], [3, '3'], [6, '6'], [10, '10']], v => { S.prefs.reviewMax = +v; save(); })),
    setRow('Nível inicial', 'Desbloqueia a trilha a partir deste nível.', sel('lvlSel', S.startLevel, LEVELS.map(Lv => [Lv, Lv + ' · ' + LEVEL_NAME[Lv]]), v => { S.startLevel = v; S.ui.level = v; save(); bump(); })),
    setRow('Plano de fluência', 'Quantas frases novas por dia para terminar o curso no prazo. O app encadeia lições até a cota do dia.', sel('planSel', S.plan.months, [[0, 'Sem prazo'], [3, '3 meses (intenso)'], [6, '6 meses (recomendado)'], [9, '9 meses'], [12, '12 meses']], v => { S.plan.months = +v; S.plan.start = +v ? today() : null; save(); render(); toast(+v ? 'Plano ativado: a trilha mostra sua cota diária.' : 'Plano desativado.'); })),
    setRow('Tentar antes de ver', 'Frases novas aparecem primeiro em português para você arriscar um palpite (efeito de geração).', toggle(S.prefs.pretest, v => { S.prefs.pretest = v; save(); })),
    setRow('Meta de lembrança', 'Quanto da memória o FSRS tenta garantir. Mais alto = revisões mais frequentes.', sel('retSel', S.prefs.retention, [[0.85, '85% · menos revisões'], [0.9, '90% · recomendado'], [0.95, '95% · máxima segurança']], v => { S.prefs.retention = +v; save(); bump(); })),
    setRow('Mostrar tradução de cara', 'Desligado, você tenta entender antes de ver.', toggle(S.prefs.autoPt, v => { S.prefs.autoPt = v; save(); })),
    setRow('Exercícios de fala', SRC ? 'Usa o microfone para conferir sua pronúncia.' : 'Este navegador não reconhece fala. Use Chrome, Edge ou Safari.', SRC ? toggle(S.prefs.mic, v => { S.prefs.mic = v; save(); }) : h('span', { class: 'pill' }, 'Indisponível'))));
  put(page, h('section', { class: 'panel' }, h('h3', { style: { marginBottom: '6px' } }, 'Áudio e aparência'),
    h('div', { class: 'set', style: { flexDirection: 'column', alignItems: 'stretch' } }, h('div', null, h('b', null, 'Voz em ' + LANG.name), h('span', null, TTS.ok ? (TTS.list.length ? 'Vozes “Natural”, “Neural” ou “Premium” soam mais humanas.' : 'Nenhuma voz em ' + LANG.name + ' listada ainda. Se não houver som, instale uma voz em ' + LANG.name + ' no sistema.') : 'Seu navegador não tem síntese de voz.')),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, voiceSel), h('button', { class: 'btn ghost', onclick: () => speak('Hi! How are you doing today?') }, icon('speaker'), 'Testar'))),
    h('div', { class: 'set', style: { flexDirection: 'column', alignItems: 'stretch' } }, h('div', { class: 'row' }, h('b', { class: 'grow' }, 'Velocidade da voz'), rateLbl), rate),
    setRow('Efeitos sonoros', null, toggle(S.prefs.sound, v => { S.prefs.sound = v; save(); })),
    setRow('Vibração', 'Em celulares compatíveis.', toggle(S.prefs.haptics, v => { S.prefs.haptics = v; save(); })),
    h('div', { class: 'set', style: { flexDirection: 'column', alignItems: 'stretch' } }, h('b', null, 'Tema'), theme)));
  put(page, languagesPanel());
  put(page, h('section', { class: 'panel' }, h('h3', { style: { marginBottom: '6px' } }, 'Seus dados'),
    h('p', { class: 'small muted' }, storageOk ? 'O progresso fica salvo neste navegador. Faça um backup de vez em quando, principalmente antes de limpar dados do navegador ou trocar de aparelho.' : 'Atenção: este navegador não está salvando o progresso. Exporte um backup agora.'),
    h('div', { style: { display: 'grid', gap: '10px', marginTop: '12px' } },
      h('button', { class: 'btn ghost', onclick: exportBackup }, 'Baixar backup do progresso'),
      h('button', { class: 'btn ghost', onclick: copyBackup }, 'Copiar backup'),
      h('button', { class: 'btn ghost', onclick: () => pickFile('backup') }, 'Restaurar backup'),
      h('button', { class: 'btn ghost', onclick: () => pickFile('phrases') }, 'Importar frases (.json)'),
      h('button', { class: 'btn ghost', onclick: exportPhrases }, 'Baixar todas as frases (.json)'),
      h('button', { class: 'btn text', style: { color: 'var(--coral)' }, onclick: resetProgress }, 'Apagar todo o progresso'))));
  put(page, scienceSection());
  return page;
}
function languagesPanel() {
  const list = courseList();
  const builtin = { id: 'en', name: (LANG_NAMES.en[1]) + ' americano', lang: 'en-US', phrases: (EMBEDDED.phrases || []).length, builtin: true };
  const all = [builtin, ...list];
  const row = c => {
    const active = COURSE.id === c.id;
    return h('div', { class: 'course' + (active ? ' on' : '') },
      h('span', { class: 'lvtag', style: { width: '46px', height: '46px', borderRadius: '12px', background: 'var(--sunk)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-display)', fontWeight: '800', color: 'var(--signal)', flex: 'none' } }, langShort(c.lang).toUpperCase()),
      h('div', { class: 'grow', style: { minWidth: 0 } }, h('b', null, c.name), h('div', { class: 'small muted' }, fmt(c.phrases) + ' frases' + (c.texts ? ' · ' + c.texts + ' textos' : '') + (c.builtin ? ' · embutido' : '') + (active ? ' · em uso' : ''))),
      active ? h('span', { class: 'pill ok' }, icon('check'), 'Ativo') : h('button', { class: 'btn ghost', style: { minHeight: '40px', padding: '0 14px' }, onclick: () => switchCourse(c.id) }, 'Usar'),
      c.builtin ? null : h('button', { class: 'icon-btn', 'aria-label': 'Remover curso', onclick: () => removeCourse(c.id) }, icon('close')));
  };
  return h('section', { class: 'panel', style: { display: 'grid', gap: '10px' } },
    h('div', { class: 'panel-title', style: { marginBottom: 0 } }, h('h3', null, 'Idiomas'), h('span', { class: 'small muted' }, 'cursos neste aparelho')),
    h('p', { class: 'small muted' }, 'Cada idioma tem progresso, revisões e missões próprios. Carregue um pacote .json (por exemplo, o curso de francês que acompanha o app) para estudar outra língua com o mesmo método.'),
    ...all.map(row),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => pickFile('pack') }, 'Carregar curso (.json)'),
      h('button', { class: 'btn text', onclick: packFormatHelp }, 'Formato do arquivo')));
}
function packFormatHelp() {
  const ex = '{\n "schema": "fluent-course-v3",\n "id": "frances",\n "title": "Francês",\n "language": "fr-FR",\n "translationLanguage": "pt-BR",\n "phrases": [\n  {"fr": "Je voudrais un café, s\'il vous plaît.", "pt": "Eu queria um café, por favor.",\n   "level": "A1", "topic": "Comida e restaurantes", "focus": "Je voudrais",\n   "note": "\\"Je voudrais\\" é o jeito educado de pedir."}\n ],\n "texts": [], "writing": [], "pairs": [], "cando": {}\n}';
  openModal([h('h2', null, 'Pacote de curso (.json)'),
    h('p', { class: 'muted small' }, 'Campos obrigatórios: "language" (código como fr-FR, la, es-ES) e "phrases" com objetos contendo a frase na língua-alvo (chave igual ao código curto da língua, ex.: "fr", ou "en") e "pt". Opcionais: id, title, level (A1–C2), topic, focus (trecho da frase), note, sound, texts, writing, pairs, cando, reductions, connectors, numbers, stopwords, lexicon. Máximo: 20 mil frases e 12 MB. O arquivo é validado e guardado neste aparelho; nada é enviado para a internet.'),
    h('pre', { class: 'model-text', style: { whiteSpace: 'pre-wrap', fontSize: '12.5px', lineHeight: '1.45' } }, ex),
    h('div', { class: 'acts' }, h('button', { class: 'btn block', onclick: closeModal }, 'Fechar'))]);
}
function scienceSection() {
  const items = [
    ['As quatro frentes da fluência', 'O linguista Paul Nation mostrou que um curso eficiente equilibra quatro frentes: input compreensível (ouvir e ler muito), produção (falar e escrever), estudo focado (vocabulário e gramática) e treino de fluência (fazer o que já sabe, mais rápido). A trilha cuida do estudo focado; a aba Praticar cobre as outras três com histórias e áudios, conversas, escrita e o Desafio relâmpago.'],
    ['Por que frases e não palavras soltas?', 'Falantes nativos produzem a maior parte da fala com blocos prontos ("I was wondering if…", "it turns out that…"). Aprender blocos inteiros acelera a fluência e a naturalidade (Wray, 2002; Boers e Lindstromberg, 2012). O painel da trilha mostra quantas das palavras mais usadas do inglês você já reconhece.'],
    ['Repetição espaçada (FSRS)', 'A memória decai em curva (Ebbinghaus). Revisar um pouco antes de esquecer rende mais do que revisar muito de uma vez (Cepeda et al., 2006). O algoritmo FSRS estima a estabilidade de cada frase na sua memória e agenda a revisão para manter a meta de lembrança que você escolher (85%, 90% ou 95%).'],
    ['Tentar antes de ver (pré-teste)', 'Arriscar um palpite antes de receber a resposta melhora a memorização mesmo quando o palpite está errado: o erro "abre espaço" para a forma certa (efeito de geração e pretesting; Kornell, Hays e Bjork, 2009; Potts e Shanks, 2014). Por isso cada frase nova aparece primeiro em português, para você tentar dizê-la na língua antes de revelar.'],
    ['Do fim ao começo (backchaining)', 'Frases longas são aprendidas mais rápido quando montadas de trás para a frente ("...you?", "...are you?", "How are you?"): a entonação final, que é a parte mais importante para soar natural, fica intacta em todas as repetições. É uma técnica clássica do ensino de pronúncia; use o botão "Do fim ao começo" nas frases novas.'],
    ['Plano de fluência e ritmo', 'Nation (2007) e Cambridge estimam 1.000 a 1.200 horas até o C2. Terminar todo o curso em 6 meses exige cerca de 45 frases novas por dia (uma hora de estudo mais imersão). O plano calcula sua cota diária, encadeia as lições e projeta a data de término com base nos seus últimos 7 dias, para que a meta seja realista e visível.'],
    ['Lembrar é melhor do que reler', 'Tentar recuperar uma resposta fortalece a memória mais do que estudar de novo (efeito de testagem, Roediger e Karpicke, 2006). Por isso quase tudo aqui é exercício: você tenta antes de ver.'],
    ['A regra dos 85%', 'Pesquisas sobre aprendizagem indicam que se aprende mais rápido quando se acerta em torno de 85% das tentativas (Wilson et al., 2019): fácil demais não ensina, difícil demais desanima. O app ajusta a dificuldade dos exercícios durante a lição para manter você perto desse ponto.'],
    ['Treino de sons com várias vozes', 'Ouvir pares mínimos (ship × sheep, think × sink) em vozes e velocidades diferentes melhora a percepção dos sons de uma língua estrangeira, e essa melhora também ajuda a pronúncia (treino fonético de alta variabilidade; Thomson, 2018).'],
    ['Ditado e fala conectada', 'O maior obstáculo para entender nativos é separar palavras na fala corrida (Field, 2008). O ditado obriga o cérebro a fazer essa segmentação, e o guia de reduções (gonna, wanna, o T americano) prepara o ouvido para séries e rádio.'],
    ['Ouvir antes de ler', 'Nas histórias e notícias, o app sugere ouvir primeiro sem o texto, captar a ideia geral e só depois ler. Esse ciclo de ouvir, conferir e ouvir de novo treina a compreensão em tempo real, que é o que você usa numa conversa.'],
    ['Falar e escrever: notar a diferença', 'Produzir a língua revela lacunas que a leitura esconde (hipótese do output, Swain, 1985). Comparar o próprio texto com um texto-modelo faz você notar o que falta, e isso acelera a evolução da escrita (Schmidt, 1990; Hanaoka, 2007). A correção também aponta erros típicos de quem fala português.'],
    ['Por que parece um jogo', 'O cérebro libera dopamina principalmente quando uma recompensa é melhor do que o esperado (erro de previsão de recompensa, Schultz, 1997). Por isso existem acertos críticos, baús e presentes com valores variáveis. Metas claras, progresso visível e escolhas próprias sustentam a motivação de longo prazo (teoria da autodeterminação, Deci e Ryan). Aqui, toda recompensa vem depois de esforço real de aprendizagem.'],
    ['Quanto tempo até o B2, C1 e C2?', 'A Cambridge estima cerca de 500 a 600 horas de estudo guiado do zero até o B2, 700 a 800 até o C1 e por volta de 1.000 a 1.200 até o C2. Dá para chegar antes somando o app (30 a 45 min/dia) com imersão diária. Para entender séries com conforto, a pesquisa aponta cerca de 3.000 famílias de palavras (95% de cobertura; Webb e Rodgers, 2009); para rádio e conversa sem esforço, de 6.000 a 7.000 (Nation, 2006).'],
    ['Durma bem', 'O cérebro consolida memórias durante o sono. Um grupo que estudou palavras à noite e dormiu lembrou mais do que outro que estudou de manhã. Estudar um pouco todos os dias e dormir bem rende mais do que maratonas.']
  ];
  return h('section', { class: 'page', style: { gap: '10px' } }, h('h2', null, 'Como o método funciona'),
    h('div', { class: 'science' }, ...items.map(([q, a]) => h('details', null, h('summary', null, q), h('p', null, a)))));
}
function download(obj, name) {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast('Arquivo ' + name + ' gerado.');
  } catch { toast('O download foi bloqueado. Use “Copiar backup”.', 'err'); }
}
const backupObj = () => ({ schema: 'fluent-backup-v3', course: COURSE.id, courseTitle: COURSE.title, language: COURSE.language, exported: new Date().toISOString(), state: S });
function exportBackup() { download(backupObj(), 'fluent_backup_' + (COURSE.id === 'en' ? '' : COURSE.id + '_') + today() + '.json'); }
async function copyBackup() {
  const txt = JSON.stringify(backupObj());
  try { await navigator.clipboard.writeText(txt); toast('Backup copiado. Cole em um arquivo de texto e guarde.'); }
  catch {
    const ta = h('textarea', { class: 'typearea', readonly: true, style: { minHeight: '160px', fontSize: '12px' } }); ta.value = txt;
    openModal([h('h2', null, 'Backup do progresso'), h('p', { class: 'muted small' }, 'Selecione tudo e copie para guardar.'), ta, h('div', { class: 'acts' }, h('button', { class: 'btn block', onclick: closeModal }, 'Fechar'))]);
    setTimeout(() => { ta.focus(); ta.select(); }, 50);
  }
}
function exportPhrases() { download({ schema: 'fluent-course-v3', id: COURSE.id === 'en' ? 'ingles' : COURSE.id, title: COURSE.title, language: COURSE.language, translationLanguage: 'pt-BR', targetKey: 'en', phrases: ALL.map(({ w, _s, _nen, _npt, extra, ...p }) => p) }, 'fluent_frases_' + COURSE.short + '.json'); }
let fileMode = 'backup';
function pickFile(mode) { fileMode = mode; const f = $('#fileIn'); f.value = ''; f.click(); }
async function onFile(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  try {
    if (file.size > 12e6) throw Error('arquivo maior que 12 MB');
    const data = JSON.parse(await file.text());
    if (fileMode === 'backup') {
      let st = null;
      if (data && data.schema === 'fluent-backup-v3' && data.state) st = data.state;
      else if (data && data.schema === 'english-fluency-backup-v1' && data.progress) {
        try { localStorage.setItem(OLD_KEY, JSON.stringify(data)); } catch {}
        // build the converted state without touching the current one (the person may still cancel)
        const keep = S; S = mergeState(DEFAULT(), null); migrateOld(); S.onboarded = true; S.prefs = keep.prefs; st = S; S = keep;
      }
      if (!st || typeof st !== 'object' || typeof st.cards !== 'object') throw Error('formato de backup não reconhecido');
      const other = data.course && data.course !== COURSE.id;
      if (!(await confirmBox('Restaurar backup?', (other ? 'Atenção: este backup é do curso "' + (data.courseTitle || data.course) + '", e o curso ativo é "' + COURSE.title + '". ' : '') + 'Isto substitui o progresso atual deste curso neste navegador.', 'Restaurar', !!other))) return;
      S = mergeState(DEFAULT(), st); S.onboarded = true; save(); buildCourse(); applyTheme(); render(); toast('Backup restaurado.');
    } else if (fileMode === 'pack') {
      const pack = await importPack(data);
      if (!pack) return;
      toast('Curso "' + pack.title + '" carregado: ' + fmt(pack.phrases.length) + ' frases.', 'ach', 'flag');
      if (await confirmBox('Começar a estudar ' + pack.name + '?', 'Você pode alternar entre os idiomas quando quiser em Perfil › Idiomas.', 'Usar agora')) await switchCourse(pack.id); else render();
    } else {
      const arr = Array.isArray(data) ? data : data && data.phrases;
      if (!Array.isArray(arr)) throw Error('o JSON precisa ter uma lista "phrases"');
      if (arr.length > 15000) throw Error('máximo de 15 mil frases por arquivo');
      const have = new Set(ALL.map(p => norm(p.en)));
      let added = 0, skipped = 0;
      arr.forEach((r, i) => { if (!validPhrase(r) || have.has(norm(r.en))) { skipped++; return; } have.add(norm(r.en)); const c = cleanExtra(r, i); delete c.extra; S.extra.push(c); added++; });
      save(); buildCourse(); render();
      toast(added + ' frases importadas' + (skipped ? ', ' + skipped + ' ignoradas (repetidas ou inválidas)' : '') + '.');
    }
  } catch (err) { toast('Não foi possível ler o arquivo: ' + err.message + '.', 'err'); }
}
async function resetProgress() {
  if (!(await confirmBox('Apagar todo o progresso?', 'XP, sequência, conquistas e o agendamento de todas as frases serão apagados. As frases importadas e as configurações ficam.', 'Apagar progresso', true))) return;
  const keep = { prefs: S.prefs, extra: S.extra, startLevel: S.startLevel };
  S = mergeState(DEFAULT(), keep); S.onboarded = true; save(); bump(); render(); toast('Progresso apagado.');
}

/* ---- side column (desktop) ---- */
function sideQuests() {
  ensureQuests();
  const q = S.quests;
  return h('section', { class: 'panel', style: { display: 'grid', gap: '8px' } }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, 'Missões de hoje'), h('span', { class: 'coins small' }, icon('coin'), fmt(S.coins))),
    ...q.list.map(it => h('div', null, h('div', { class: 'small', style: { fontWeight: '700' } }, (it.done ? '✓ ' : '') + QUESTS[it.id].t(it.goal)), h('div', { class: 'bar amber', style: { height: '6px', marginTop: '4px' } }, h('span', { style: { width: Math.round(it.prog * 100 / it.goal) + '%' } })))),
    claimable() ? h('button', { class: 'btn gold', onclick: () => go('quests') }, 'Resgatar recompensas') : null);
}
function renderSide() {
  const side = $('#side'); if (!side) return;
  if (innerWidth < 1180) { kids(side, ); return; }
  const pct = Math.min(100, Math.round(xpToday() * 100 / S.prefs.goal));
  const st = displayStreak();
  const next = ACH.find(a => !S.ach[a.id]);
  kids(side, 
    h('section', { class: 'panel' }, h('div', { class: 'row' }, h('div', { style: { color: st ? 'var(--flame)' : 'var(--muted)' } }, icon('flame', 'ic')), h('h3', { class: 'grow' }, st + (st === 1 ? ' dia seguido' : ' dias seguidos')), h('span', { class: 'pill', title: 'Protetores de sequência' }, icon('snow'), S.streak.freezes)), weekDots()),
    h('section', { class: 'panel' }, h('div', { class: 'row' }, h('div', { class: 'goal-ring', style: { '--p': pct } }, h('span', null, pct + '%')), h('div', { class: 'grow' }, h('h3', null, 'Meta diária'), h('p', { class: 'small muted tnum' }, xpToday() + ' de ' + S.prefs.goal + ' XP')))),
    sideQuests(),
    h('section', { class: 'panel' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h3', null, 'Revisões'), h('p', { class: 'small muted' }, dueList().length ? dueList().length + ' para hoje' : 'Tudo em dia')), dueList().length ? h('button', { class: 'btn', onclick: () => go('review') }, 'Revisar') : null)),
    next ? h('section', { class: 'panel' }, h('p', { class: 'small muted' }, 'Próxima conquista'), h('div', { class: 'row', style: { marginTop: '6px' } }, h('div', { class: 'medal', style: { width: '40px', height: '40px', borderRadius: '12px', background: 'var(--sunk)', display: 'grid', placeItems: 'center', color: 'var(--muted)' } }, icon('star')), h('div', { class: 'grow' }, h('b', null, next.t), h('div', { class: 'small muted' }, next.d)))) : null);
}

/*@MODULES@*/

/* =========================================================
   Onboarding
   ========================================================= */
function onboarding(step = 1, choice = {}) {
  if (step === 1) {
    openModal([
      h('div', { class: 'brand', style: { fontSize: '30px' } }, 'fluent', h('span', { class: 'brand-dot' })),
      h('h2', null, LANG.Name + ' de verdade, uma frase por vez.'),
      h('p', { class: 'muted' }, 'Você ouve, monta, escreve e fala frases usadas no dia a dia' + (LANG.isEn ? ' americano' : '') + '. O app agenda cada revisão no dia em que você estaria prestes a esquecer, e o treino de escuta prepara seu ouvido para séries, rádio e conversa com nativos.'),
      S.migrated ? h('p', { class: 'pill ok' }, 'Seu progresso anterior foi importado: ' + S.migrated + ' frases.') : null,
      h('div', { class: 'acts' }, h('button', { class: 'btn big block', onclick: () => onboarding(2, choice) }, 'Começar'))
    ], () => { if (!S.onboarded) { S.onboarded = true; save(); } });
    return;
  }
  if (step === 2) {
    const opts = [['A1', 'Começando do zero', 'Ou quase. Vamos do básico.'], ['A2', 'Sei o básico', 'Me apresento e entendo frases simples.'], ['B1', 'Me viro', 'Viagens e conversas do dia a dia.'], ['B2', 'Converso bem', 'Mas travo com nativos falando rápido.'], ['C1', 'Quero refinar', 'Nuances, argumentação e expressões.'], ['C2', 'Quase nativo', 'Estilo, ironia e precisão.']];
    let sel = choice.level || 'A1';
    const list = h('div', { class: 'choice-list' });
    const paint = () => kids(list, ...opts.map(([lv, t, d]) => h('button', { class: 'choice' + (sel === lv ? ' on' : ''), onclick: () => { sel = lv; paint(); } }, h('span', { class: 'lvtag' }, lv), h('div', null, h('b', null, t), h('span', null, d)))));
    paint();
    openModal([h('h2', null, 'Qual é o seu nível hoje?'), h('p', { class: 'muted small' }, 'Os níveis anteriores continuam disponíveis para praticar.'), list,
      h('div', { class: 'acts' }, h('button', { class: 'btn big block', onclick: () => onboarding(3, { ...choice, level: sel }) }, 'Continuar'))], () => { if (!S.onboarded) { S.onboarded = true; save(); } });
    return;
  }
  const goals = [[150, 'Leve', '~5 min por dia'], [300, 'Regular', '~10 min por dia'], [600, 'Sério', '~20 min por dia'], [1000, 'Intenso', '~35 min por dia']];
  let g = choice.goal || 300, months = 6;
  const list = h('div', { class: 'choice-list' });
  const paint = () => kids(list, ...goals.map(([v, t, d]) => h('button', { class: 'choice' + (g === v ? ' on' : ''), onclick: () => { g = v; paint(); } }, h('span', { class: 'lvtag', style: { fontSize: '13px' } }, v), h('div', null, h('b', null, t), h('span', null, d)))));
  paint();
  const perDay6 = Math.ceil(ALL.length / 183 / UNIT_SIZE) * UNIT_SIZE;
  const plans = [[6, 'Plano de 6 meses', 'Terminar as ' + fmt(ALL.length) + ' frases: ~' + perDay6 + ' novas por dia, cerca de 1 h'], [12, 'Plano de 12 meses', '~' + Math.ceil(ALL.length / 365 / UNIT_SIZE) * UNIT_SIZE + ' novas por dia, cerca de 30 min'], [0, 'Sem prazo', 'Só a meta diária de XP']];
  const plist = h('div', { class: 'choice-list' });
  const paintP = () => kids(plist, ...plans.map(([v, t, d]) => h('button', { class: 'choice' + (months === v ? ' on' : ''), onclick: () => { months = v; paintP(); } }, h('span', { class: 'lvtag', style: { fontSize: '13px' } }, v ? v + 'm' : '∞'), h('div', null, h('b', null, t), h('span', null, d)))));
  paintP();
  openModal([h('h2', null, 'Qual será sua meta diária?'), h('p', { class: 'muted small' }, 'Constância vence intensidade. Dá para mudar depois no Perfil.'), list,
    h('h3', { style: { marginTop: '6px' } }, 'Quer um prazo para a fluência?'), h('p', { class: 'muted small' }, 'O plano calcula sua cota diária de frases novas e encadeia as lições. A meta de XP cobre revisões e prática.'), plist,
    h('div', { class: 'acts' }, h('button', { class: 'btn big block', onclick: () => { S.startLevel = choice.level || 'A1'; S.ui.level = S.startLevel; S.prefs.goal = g; S.plan = { months, start: months ? today() : null }; S.onboarded = true; save(); bump(); closeModal(); render(); toast('Tudo pronto. Sua primeira lição está esperando!'); } }, 'Começar a aprender'))],
    () => { if (!S.onboarded) { S.onboarded = true; save(); } });
}

/* =========================================================
   Global events & boot
   ========================================================= */
let ignorePop = false;
function bindGlobal() {
  $$('.tab').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  $('#lessonClose').addEventListener('click', askExit);
  $('#stageClose').addEventListener('click', askCloseStage);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  $('#fileIn').addEventListener('change', onFile);
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    if (!$('#modal').hidden) { closeModal(); if (lessonOpen() && L && !L.finished) { try { history.pushState({ fl: 1 }, ''); } catch {} } return; }
    if (lessonOpen() && L) {
      if (L.finished) { L.pushed = false; closeLesson(true); return; }
      try { history.pushState({ fl: 1 }, ''); } catch {}
      askExit();
      return;
    }
    if (stageOpen()) {
      if (ST.dirty) { try { history.pushState({ fl: 2 }, ''); } catch {} askCloseStage(); }
      else { ST.pushed = false; closeStage({ fromPop: true }); }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
    if (!lessonOpen() && stageOpen()) { if (e.key === 'Escape') { e.preventDefault(); askCloseStage(); } return; }
    if (!lessonOpen() || !L) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
    if (e.key === 'Escape') { e.preventDefault(); askExit(); return; }
    const ae = document.activeElement;
    const onPlainButton = ae && ae.tagName === 'BUTTON' && !ae.id && !!ae.closest('#lesson');
    if (e.key === 'Enter') {
      if (onPlainButton) return;
      if (L.phase === 'feedback') { e.preventDefault(); nextItem(); return; }
      if (L.ex && L.ex.main) { e.preventDefault(); L.ex.main(); }
      return;
    }
    if (typing) return;
    if (L.phase === 'answer' && L.ex && L.ex.keys && /^[1-9]$/.test(e.key)) { e.preventDefault(); L.ex.keys(e.key); return; }
    if (e.key === ' ' && !onPlainButton && L.ex && L.ex.audio) { e.preventDefault(); L.ex.audio(); }
  });
  const vv = window.visualViewport;
  const setVV = () => { const root = document.documentElement.style; if (vv) { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); } };
  if (vv) { vv.addEventListener('resize', setVV); vv.addEventListener('scroll', setVV); setVV(); }
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!lessonOpen()) renderSide(); }, 150); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !lessonOpen() && !stageOpen() && $('#modal').hidden) { bump(); ensureQuests(); render(); } });
  // unlock audio on first interaction (iOS)
  const unlock = () => { ac(); if (TTS.ok) { try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; speechSynthesis.speak(u); } catch {} } document.removeEventListener('pointerdown', unlock, true); };
  document.addEventListener('pointerdown', unlock, true);
  if (TTS.ok) { loadVoices(); try { speechSynthesis.addEventListener('voiceschanged', () => { loadVoices(); if (TAB === 'profile' && !lessonOpen()) render(); }); } catch { speechSynthesis.onvoiceschanged = loadVoices; } setTimeout(loadVoices, 600); }
}
async function boot() {
  // the active course may be a loaded pack (IndexedDB); fall back to the built-in English course on any problem
  let pack = null, wanted = activeCourseId();
  if (wanted !== 'en') { try { pack = await loadPack(wanted); } catch (e) { console.warn('curso não carregado:', e); } }
  if (!pack) { pack = normalizePack(EMBEDDED, true); if (wanted !== 'en') { setActiveCourseId('en'); setTimeout(() => toast('O curso selecionado não pôde ser aberto; voltei para o inglês.', 'err'), 800); } }
  setCourse(pack);
  load(); applyTheme(); buildCourse(); bindGlobal();
  const hash = (location.hash || '').replace('#', '');
  TAB = ['home', 'review', 'practice', 'quests', 'profile'].includes(hash) ? hash : 'home';
  ensureQuests(); applyAccent();
  render();
  if (!S.onboarded) onboarding(1);
  save();
  if (/[?&]test\b/.test(location.search)) window.__fl = { get L() { return L; }, S: () => S, ALL: () => ALL, get TEXTS() { return TEXTS; }, get WRITING() { return WRITING; }, get PAIRS() { return PAIRS; }, get LANG() { return LANG; }, get COURSE() { return COURSE; }, clozeTarget, tilesOf, bump, render, analyzeWriting, ensureQuests, questEvent, align, norm, get SUB() { return SUB; }, ST, openSub, openLightning, openTalk, openReader, openWriting, startPairs, distractors, synonymsEn, startLesson, buildUnitItems, nextUnit, mk, importPack, switchCourse, removeCourse, courseList, normalizePack, planInfo, intervalFor, backchain };
}
function bootError(err) {
  console.error(err);
  document.getElementById('view').replaceChildren(h('div', { class: 'panel' }, h('h2', null, 'Algo deu errado ao abrir o curso.'), h('p', { class: 'muted' }, 'Recarregue a página. Se continuar, restaure um backup no Perfil. Detalhe: ' + (err && err.message))));
}
try { boot().catch(bootError); } catch (err) { bootError(err); }
})();
