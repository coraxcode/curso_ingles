/* =========================================================
   Practice hub & quests views
   ========================================================= */
let SUB = null;
function openSub(s) { SUB = s; render(); window.scrollTo(0, 0); }
function gymStart(type, title) {
  const learned = learnedList();
  if (learned.length < 5) { toast('Aprenda pelo menos 5 frases na trilha para liberar este treino.'); return; }
  const sel = shuffle(learned).sort((a, b) => S.cards[a.id].s - S.cards[b.id].s).slice(0, 30);
  startLesson(shuffle(sel).slice(0, 10).map(p => mk(type, p)), { mode: 'gym', rate: S.ui.gymRate, title });
}
function viewPractice() {
  if (SUB === 'texts') return viewTexts();
  if (SUB === 'talk') return viewTexts('talk');
  if (SUB === 'write') return viewWritingList();
  if (SUB === 'sounds') return viewSounds();
  if (SUB === 'listen') { const p = viewListen(); return p; }
  if (SUB === 'library') return viewLibrary();
  const page = h('div', { class: 'page' });
  put(page, h('div', { class: 'page-head' }, h('h1', null, 'Praticar'), h('p', { class: 'muted' }, 'A fluência vem de quatro frentes ao mesmo tempo: muito input (ouvir e ler), muita produção (falar e escrever), estudo focado e treino de velocidade. A trilha cuida do estudo focado; aqui você treina o resto.')));
  const textsDone = TEXTS.filter(t => (textState(t).best || 0) >= 0.6).length;
  const dlg = TEXTS.filter(t => t.type === 'dialogue');
  const talkDone = dlg.filter(t => (textState(t).rp || 0) >= 0.7).length;
  const wDone = WRITING.filter(w => S.writing[w.id] && (S.writing[w.id].hist || []).length).length;
  const pDone = PAIRS.filter(c => (pairAcc(c.id) || 0) >= 0.85).length;
  const meter = (a, b) => h('div', { class: 'meter' }, h('i', { style: { width: (b ? Math.round(a * 100 / b) : 0) + '%' } }));
  const tool = (ic, title, desc, prog, onclick, badge) => { const b = h('button', { class: 'tool' }, badge ? h('span', { class: 'badge-new' }, badge) : null, icon(ic), h('b', null, title), h('span', null, desc), prog || null); b.addEventListener('click', onclick); return b; };
  const section = (title, sub, ...tools) => h('section', { class: 'skill' }, h('div', { class: 'skill-head' }, h('h2', null, title), h('span', { class: 'small muted' }, sub)), h('div', { class: 'tool-grid' }, ...tools));
  const pairEx = PAIRS.slice(0, 2).map(c => c.name).join(', ');
  const listenTools = [
    TEXTS.length ? tool('text', 'Histórias e áudios', textsDone + ' de ' + TEXTS.length + ' concluídos · diálogos, notícias, podcasts', meter(textsDone, TEXTS.length), () => openSub('texts')) : null,
    tool('ear', 'Treino de escuta', 'Ditado, entender só de ouvido, Modo rádio' + (LANG.reductions.length ? ' e como os nativos falam' : ''), null, () => openSub('listen')),
    PAIRS.length ? tool('wave', 'Sons do ' + LANG.name, pDone + ' de ' + PAIRS.length + ' sons dominados · ' + pairEx + '…', meter(pDone, PAIRS.length), () => openSub('sounds')) : null];
  const speakTools = [
    dlg.length ? tool('chat', 'Conversas', talkDone + ' de ' + dlg.length + ' conversas · você responde em voz alta', meter(talkDone, dlg.length), () => openSub('talk')) : null,
    SRC ? tool('mic', 'Ouça e repita', '10 frases em shadowing: imite ritmo e entonação', null, () => gymStart('shadow', 'Ouça e repita')) : null];
  put(page,
    section('Ouvir e ler', 'input compreensível', ...listenTools),
    speakTools.some(Boolean) ? section('Falar', 'produção oral', ...speakTools) : null,
    WRITING.length ? section('Escrever', 'produção escrita',
      tool('pen', 'Escrita guiada', wDone + ' de ' + WRITING.length + ' propostas · correção automática e texto-modelo', meter(wDone, WRITING.length), () => openSub('write'))) : null,
    section('Velocidade', 'automaticidade',
      tool('bolt', 'Desafio relâmpago', 'Recorde: ' + (S.light.best || 0) + ' pontos em 60 segundos', null, () => openLightning(), (S.light.plays || 0) === 0 ? 'Novo' : null)),
    section('Vocabulário', 'consulta',
      tool('book', 'Todas as frases', fmt(ALL.length) + ' frases com busca e áudio', null, () => openSub('library'))),
    immersionPanel());
  return page;
}
const IMM_XP_MAX = 120, IMM_DAY_MAX = 600;
const IMMERSION_GENERIC = lv => LEVELS.indexOf(lv) <= 1
  ? ['Vídeos curtos com legenda em ' + LANG.name + ' sobre rotina e viagem.', 'Podcasts para iniciantes com fala lenta.', 'Ouça as frases do app no Modo rádio enquanto caminha.']
  : LEVELS.indexOf(lv) <= 3 ? ['Séries e filmes com legenda em ' + LANG.name + ', sem português.', 'Podcasts com transcrição: leia depois de ouvir.', 'Rádio de notícias por 10 minutos por dia.']
  : ['Rádio e podcasts nativos em velocidade normal.', 'Livros em ' + LANG.name + ' com audiobook ao mesmo tempo.', 'Comédia e debates, onde o humor depende de ironia e subentendidos.'];
function immersionPanel() {
  const t = today(), mins = S.imm[t] || 0, total = immTotal();
  const lv = nextUnit() ? nextUnit().level : 'C2';
  const tips = (LANG.immersion && (LANG.immersion[lv] || LANG.immersion.C1)) || IMMERSION_GENERIC(lv);
  return h('section', { class: 'panel', style: { display: 'grid', gap: '12px' } },
    h('div', { class: 'panel-title', style: { marginBottom: 0 } }, h('h3', null, LANG.Name + ' real de hoje'), h('span', { class: 'small muted tnum' }, fmt(total) + ' min no total')),
    h('p', { class: 'muted small' }, 'Séries, podcasts, rádio, vídeos. As frases do app dão a base; o volume de escuta real é o que leva à fluência. Registre e ganhe 5 XP por minuto (até 2 horas por dia).'),
    h('div', { class: 'row' }, h('div', { class: 'dial-pct', style: { fontSize: '34px' } }, mins), h('span', { class: 'muted' }, 'minutos hoje · meta 20'), h('div', { class: 'bar mint grow' }, h('span', { style: { width: Math.min(100, mins * 5) + '%' } }))),
    h('div', { class: 'imm-btns' }, ...[5, 15, 30, 60].map(m => h('button', { class: 'btn ghost', onclick: () => {
      const before = S.imm[t] || 0;
      if (before >= IMM_DAY_MAX) { toast('Você já registrou ' + IMM_DAY_MAX + ' minutos hoje. Que dedicação! Volte amanhã.'); return; }
      const add = Math.min(m, IMM_DAY_MAX - before);
      S.imm[t] = before + add;
      // XP only for the first two hours a day, so the number keeps meaning real effort
      const xpMin = Math.max(0, Math.min(before + add, IMM_XP_MAX) - Math.min(before, IMM_XP_MAX));
      const g = xpMin ? addXP(xpMin * 5) : 0;
      questEvent('imm', add); touchStreakSoft(); save(); bump(); checkAch();
      toast(g ? '+' + g + ' XP por ' + add + ' min de ' + LANG.name + ' real' : add + ' min registrados. O XP diário de imersão já chegou ao máximo.', '', 'bolt'); render();
    } }, '+' + m + ' min'))),
    h('div', null, h('b', { class: 'small' }, 'Sugestões para o seu nível (' + lv + ')'), h('ul', { class: 'small muted', style: { margin: '6px 0 0', paddingLeft: '18px' } }, ...tips.map(x => h('li', null, x)))));
}
function viewQuests() {
  ensureQuests();
  const page = h('div', { class: 'page' });
  put(page, h('div', { class: 'page-head' }, h('h1', null, 'Missões'), h('p', { class: 'muted' }, 'Três missões novas por dia e duas por semana. Complete, resgate as moedas e troque na loja.')));
  put(page, h('div', { class: 'row' }, h('div', { class: 'coins', style: { fontSize: '26px' } }, icon('coin'), fmt(S.coins)), h('span', { class: 'muted small' }, 'moedas')));
  const q = S.quests;
  const qrow = (it, def, weekly) => {
    const pct = Math.round(it.prog * 100 / it.goal);
    const btn = it.done && !it.claimed ? h('button', { class: 'btn gold', style: { minHeight: '40px', padding: '0 14px' }, onclick: () => claimQuest(it, weekly) }, 'Resgatar') : h('span', { class: 'coins small' }, it.claimed ? icon('check') : icon('coin'), it.claimed ? '' : String(weekly ? WQ[it.id].coins : def.coins));
    return h('div', { class: 'quest' + (it.done ? ' done' : '') }, h('span', { class: 'qicon' }, icon(it.done ? 'check' : (def.icon || 'flag'))),
      h('div', { style: { minWidth: 0 } }, h('b', null, def.t(it.goal)), h('div', { class: 'bar amber' }, h('span', { style: { width: pct + '%' } })), h('span', { class: 'small muted tnum' }, fmt(it.prog) + ' / ' + fmt(it.goal))),
      h('div', { class: 'rew' }, btn));
  };
  put(page, h('section', { class: 'page', style: { gap: '10px' } }, h('div', { class: 'levelbar' }, h('h2', null, 'Missões de hoje'), h('span', { class: 'small muted' }, 'renovam à meia-noite')),
    ...q.list.map(it => qrow(it, QUESTS[it.id], false)),
    q.list.every(x => x.claimed) && !q.bonus ? h('button', { class: 'btn big gold block', onclick: openQuestChest }, icon('chest'), 'Abrir baú das missões') :
      h('p', { class: 'small muted' }, q.bonus ? 'Baú de hoje já aberto. Volte amanhã!' : 'Resgate as três missões para abrir o baú das missões.')));
  put(page, h('section', { class: 'page', style: { gap: '10px' } }, h('h2', null, 'Missões da semana'), ...q.wlist.map(it => qrow(it, { t: WQ[it.id].t, coins: WQ[it.id].coins, icon: it.id === 'wxp' ? 'bolt' : 'flame' }, true))));
  const tw = weekXP(0), lw = weekXP(1);
  put(page, h('section', { class: 'panel' }, h('div', { class: 'panel-title' }, h('h3', null, 'Você vs. você na semana passada'), h('span', { class: 'small muted' }, 'XP')),
    h('div', { class: 'vs' }, h('div', { class: 'stat' }, h('b', null, fmt(tw)), h('span', null, 'esta semana')), h('div', { class: 'stat' }, h('b', null, fmt(lw)), h('span', null, 'semana passada'))),
    h('p', { class: 'small', style: { marginTop: '10px' } }, tw > lw ? 'Você já superou a semana passada. Continue!' : lw ? 'Faltam ' + fmt(lw - tw + 1) + ' XP para superar a semana passada.' : 'Sua primeira semana: cada XP conta.')));
  const shop = h('div', { class: 'shop' }, ...SHOP.map(it => {
    const owned = it.accent && S.shop.owned.includes(it.id), active = it.accent && S.shop.accent === it.accent;
    const b = h('button', { class: 'btn ' + (owned ? 'ghost' : 'gold'), disabled: active ? true : null }, active ? 'Em uso' : owned ? 'Usar' : h('span', { class: 'coins' }, icon('coin'), it.price));
    b.addEventListener('click', () => buyItem(it));
    return h('div', { class: 'sitem' }, it.color ? h('div', { class: 'swatch', style: { background: it.color } }) : null, h('b', null, it.t), h('span', null, it.d), b);
  }));
  const defAcc = S.shop.accent !== 'default' ? h('button', { class: 'btn text', onclick: () => { S.shop.accent = 'default'; applyAccent(); save(); render(); } }, 'Voltar ao tema padrão') : null;
  put(page, h('section', { class: 'page', style: { gap: '10px' } }, h('h2', null, 'Loja'), shop, defAcc));
  return page;
}
function candoPanel() {
  const lv = nextUnit() ? nextUnit().level : 'C2';
  const box = h('section', { class: 'page', style: { gap: '10px' } }, h('div', { class: 'levelbar' }, h('h2', null, 'Metas do CEFR'), h('span', { class: 'small muted' }, 'autoavaliação')),
    h('p', { class: 'small muted' }, 'Marque o que você já consegue fazer em ' + LANG.name + ' de verdade, fora do app. Ver o próprio avanço em habilidades reais é um dos maiores motivadores para continuar.'));
  const seg = h('div', { class: 'seg' });
  const list = h('div', { class: 'panel cando' });
  let cur = S.ui.candoLevel && CANDO[S.ui.candoLevel] ? S.ui.candoLevel : (CANDO[lv] ? lv : 'A1');
  const paint = () => {
    kids(seg, ...LEVELS.filter(L2 => CANDO[L2]).map(L2 => { const n = Object.values(S.cando[L2] || {}).filter(Boolean).length; return h('button', { class: L2 === cur ? 'on' : '', onclick: () => { cur = L2; S.ui.candoLevel = L2; save(); paint(); } }, L2, h('small', null, n + '/' + CANDO[L2].length)); }));
    kids(list, ...(CANDO[cur] || []).map((txt, i) => {
      const inp = h('input', { type: 'checkbox' }); inp.checked = !!(S.cando[cur] && S.cando[cur][i]);
      inp.addEventListener('change', () => { S.cando[cur] = S.cando[cur] || {}; S.cando[cur][i] = inp.checked; if (inp.checked) { SFX.ok(3); buzz(10); } save(); paint(); checkAch(); });
      return h('label', null, inp, h('span', null, txt));
    }));
  };
  paint();
  put(box, seg, list);
  return box;
}
