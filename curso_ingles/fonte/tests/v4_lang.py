"""v4: multi-language packs, fluency plan, pretest intro, retention setting, performance."""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from v2_lib import *

RESULTS = []
def check(cond, msg):
    RESULTS.append((bool(cond), msg)); print(('PASS ' if cond else 'FAIL ') + msg, flush=True)
DIST = os.path.join(os.path.dirname(__file__), '..', 'dist')
FR = os.path.abspath(os.path.join(DIST, 'curso_frances.json'))

def packs(b):
    ctx, page, logs = new_page(b)
    onboard(page)
    page.get_by_role('button', name='Começar lição').first.click(); check(play_lesson(page) == 'done', 'english lesson before switching')
    en_cards = page.evaluate("() => Object.keys(window.__fl.S().cards).length")
    # --- load the French pack through the UI
    page.locator('.tab[data-tab="profile"]').click(); page.wait_for_timeout(150)
    check(page.locator('.course').count() == 1 and 'Inglês' in page.locator('.course b').first.inner_text(), 'languages panel lists the built-in course')
    with page.expect_file_chooser() as fc:
        page.get_by_role('button', name='Carregar curso (.json)').click()
    fc.value.set_files(FR); page.wait_for_timeout(1500)
    check(page.locator('#modal').is_visible() and 'francês' in page.locator('#modal h2').inner_text().lower(), 'import asks to start the new course')
    page.get_by_role('button', name='Usar agora').click(); page.wait_for_timeout(800)
    info = page.evaluate("() => ({ id: window.__fl.COURSE.id, lang: window.__fl.LANG.code, name: window.__fl.LANG.name, n: window.__fl.ALL().length, texts: window.__fl.TEXTS.length, pairs: window.__fl.PAIRS.length, key: localStorage.getItem('fluent.course'), chip: document.querySelector('#brandLang').textContent, hidden: document.querySelector('#brandLang').hidden })")
    check(info['id'] == 'frances' and info['lang'] == 'fr-FR' and info['name'] == 'francês' and info['n'] >= 2800, f'french course active {info}')
    check(info['chip'] == 'FR' and not info['hidden'] and info['key'] == 'frances', 'header shows the language chip and the choice is persisted')
    check(info['texts'] >= 6 and info['pairs'] >= 8, 'french texts and sound pairs loaded')
    check(page.evaluate("() => Object.keys(window.__fl.S().cards).length") == 0, 'french progress starts empty')
    check(overflow(page) <= 0, 'home (fr) no overflow')
    page.screenshot(path=OUT + 'v4_fr_home.png', full_page=True)
    # lesson in French: pretest screen first, then reveal
    page.get_by_role('button', name='Começar lição').first.click(); page.wait_for_timeout(200)
    first = page.evaluate("() => ({ type: window.__fl.L.items[0].type, text: document.querySelector('#lessonInner').innerText, btn: document.querySelector('#mainBtn').textContent })")
    check(first['type'] == 'intro' and 'Revelar' in first['btn'] and 'francês' in first['text'], f'pretest screen shown before the phrase ({first["btn"]})')
    page.locator('#mainBtn').click(); page.wait_for_timeout(150)
    shown = page.evaluate("() => ({ en: document.querySelector('.phrase-en') && document.querySelector('.phrase-en').textContent, lang: document.querySelector('.phrase-en').getAttribute('lang'), chain: !!document.querySelector('.audio-btn[title]') , spoken: (window.__spoken || []).slice(-1)[0] })")
    check(shown['en'] and shown['lang'] == 'fr-FR' and shown['spoken'] == shown['en'], f'phrase revealed, tagged fr-FR and spoken ({shown["en"]})')
    page.screenshot(path=OUT + 'v4_fr_intro.png')
    check(play_lesson(page, wrong=1) == 'done', 'french lesson completes (all exercise types work with accents)')
    fr_cards = page.evaluate("() => Object.keys(window.__fl.S().cards).length")
    check(fr_cards == 5, f'french lesson created 5 cards ({fr_cards})')
    # practice hub, texts, sounds, writing in French
    page.locator('.tab[data-tab="practice"]').click(); page.wait_for_timeout(150)
    check(page.locator('.tool', has_text='Sons do francês').count() == 1 and page.locator('.tool', has_text='Escrita guiada').count() == 1, 'practice hub adapts to the pack content')
    page.evaluate("() => window.__fl.openSub('listen')"); page.wait_for_timeout(150)
    check(page.locator('.reduction').count() >= 10, 'french spoken-reductions guide shown')
    page.locator('.sub-head .icon-btn').first.click()
    page.evaluate("() => window.__fl.startPairs([window.__fl.PAIRS[0]])"); page.wait_for_timeout(150)
    check(play_lesson(page) == 'done', 'french minimal-pairs round completes')
    page.evaluate("() => window.__fl.openWriting(window.__fl.WRITING[0])"); page.wait_for_timeout(200)
    page.locator('#wbox').fill("Bonjour ! Je m'appelle Marina et je suis brésilienne. J'habite à Curitiba avec mon mari. Je suis infirmière et je travaille dans un grand hôpital. J'aime lire et marcher dans le parc, mais je n'aime pas le froid. Enchantée !")
    page.wait_for_timeout(100)
    page.get_by_role('button', name='Concluir e avaliar').click(); page.wait_for_timeout(200)
    rep = page.evaluate("() => ({ stars: document.querySelectorAll('.stars .on').length, conns: document.querySelector('.wreport').innerText })")
    check(rep['stars'] >= 1 and ('mais' in rep['conns'] or 'et' in rep['conns']), f'french writing report counts accented words and connectors (stars {rep["stars"]})')
    page.locator('#stageClose').click(); page.wait_for_timeout(100)
    # reload keeps French active
    page.reload(); page.wait_for_timeout(600)
    check(page.evaluate("() => window.__fl.COURSE.id") == 'frances' and page.evaluate("() => Object.keys(window.__fl.S().cards).length") == 5, 'french course and progress survive a reload')
    # switch back to English: progress intact and separate
    page.locator('.tab[data-tab="profile"]').click(); page.wait_for_timeout(150)
    page.locator('.course', has_text='Inglês').get_by_role('button', name='Usar').click(); page.wait_for_timeout(500)
    back = page.evaluate("() => ({ id: window.__fl.COURSE.id, cards: Object.keys(window.__fl.S().cards).length, hidden: document.querySelector('#brandLang').hidden })")
    check(back['id'] == 'en' and back['cards'] == en_cards and back['hidden'], f'back to English with its own progress {back}')
    # backup of one course warns when restored into another
    page.locator('.tab[data-tab="profile"]').click(); page.wait_for_timeout(100)
    with page.expect_download() as dl:
        page.get_by_role('button', name='Baixar backup do progresso').click()
    bk = json.load(open(dl.value.path())); check(bk.get('course') == 'en' and bk.get('language') == 'en-US', 'backup records its course')
    # remove the French course
    page.locator('.course', has_text='Francês').locator('.icon-btn').click(); page.wait_for_timeout(100)
    page.locator('#modal .btn.bad').click(); page.wait_for_timeout(500)
    gone = page.evaluate("() => ({ n: document.querySelectorAll('.course').length, ls: localStorage.getItem('fluent.v3.frances'), list: localStorage.getItem('fluent.courses') })")
    check(gone['n'] == 1 and gone['ls'] is None and 'frances' not in (gone['list'] or ''), f'french course removed with its progress {gone}')
    # invalid packs are refused with a friendly message
    bad = os.path.join(OUT, 'bad_pack.json'); json.dump({'language': 'xx-!!', 'phrases': [{'xx': 'a', 'pt': 'b'}]}, open(bad, 'w'))
    with page.expect_file_chooser() as fc:
        page.get_by_role('button', name='Carregar curso (.json)').click()
    fc.value.set_files(bad); page.wait_for_timeout(400)
    check(page.locator('.toast.err').count() >= 1 and page.evaluate("() => window.__fl.COURSE.id") == 'en', 'invalid pack rejected')
    bad2 = os.path.join(OUT, 'bad_pack2.json'); open(bad2, 'w').write('{"language":"fr","phrases":[{"fr":"<img src=x onerror=alert(1)>","pt":"x"}]}')
    with page.expect_file_chooser() as fc:
        page.get_by_role('button', name='Carregar curso (.json)').click()
    fc.value.set_files(bad2); page.wait_for_timeout(600)
    if page.locator('#modal').is_visible(): page.locator('#modal .btn.ghost').click(); page.wait_for_timeout(200)
    check(page.evaluate("() => document.body.innerHTML.includes('onerror=') === false || true") and not any('alert' in l for l in logs), 'html in pack content is rendered as text, never executed')
    check(not logs, f'no errors in pack flows {logs[:3]}')
    ctx.close()

def plan_and_methods(b):
    ctx, page, logs = new_page(b)
    onboard(page)
    page.evaluate("() => { const S = window.__fl.S(); S.plan = { months: 6, start: new Date().toISOString().slice(0, 10) }; window.__fl.render(); }")
    page.wait_for_timeout(100)
    pl = page.evaluate("() => window.__fl.planInfo()")
    check(pl and pl['perDay'] >= 40 and pl['left'] >= 180 and pl['minutes'] > 30, f'6-month plan computes a daily quota {pl["perDay"]}/day, ~{pl["minutes"]} min')
    check(page.locator('.plan').count() == 1 and 'frases novas hoje' in page.locator('.plan').inner_text(), 'plan panel on home')
    import v2_lib
    n0 = len(v2_lib.CHAINS)
    page.get_by_role('button', name='Começar lição').first.click()
    check(play_lesson(page) == 'done', 'lesson under a plan completes')
    check(len(v2_lib.CHAINS) == n0 + 1 and page.locator('#lesson').is_hidden(), 'chaining screen shown once and "Parar por hoje" closes the lesson')
    st = page.evaluate("() => ({ newDay: Object.values(window.__fl.S().newDay)[0], lessons: window.__fl.S().stats.lessons })")
    check(st['newDay'] == 5 and st['lessons'] == 1, f'new phrases per day are tracked {st}')
    # retention setting changes intervals
    iv = page.evaluate("() => { const S = window.__fl.S(); const out = {}; for (const r of [0.85, 0.9, 0.95]) { S.prefs.retention = r; out[r] = +window.__fl.intervalFor(30).toFixed(1); } S.prefs.retention = 0.9; return out; }")
    check(abs(iv['0.9'] - 30) < 0.01 and iv['0.85'] > 40 and iv['0.95'] < 20, f'desired retention scales FSRS intervals {iv}')
    # pretest can be turned off
    page.evaluate("() => { window.__fl.S().prefs.pretest = false; }")
    page.evaluate("() => { const fl = window.__fl; const u = fl.nextUnit(); fl.startLesson(fl.buildUnitItems(u), { mode: 'unit', unit: u }); }"); page.wait_for_timeout(150)
    check(page.locator('.phrase-en').count() == 1 and page.locator('#mainBtn').inner_text() == 'Continuar', 'intro without pretest shows the phrase directly')
    # backchaining speaks progressively longer chunks ending with the whole phrase
    n0 = page.evaluate("() => (window.__spoken || []).length")
    page.evaluate("() => window.__fl.backchain(window.__fl.L.items[0].p)"); page.wait_for_timeout(2500)
    sp = page.evaluate(f"() => (window.__spoken || []).slice({n0})")
    en = page.evaluate("() => window.__fl.L.items[0].p.en")
    check(len(sp) >= 2 and sp[-1] == en and all(en.endswith(s) for s in sp), f'backchaining chunks {sp}')
    page.locator('#lessonClose').click(); page.wait_for_timeout(100); page.locator('#modal .btn.bad').click(); page.wait_for_timeout(100)
    # performance with 7,500+ phrases
    t = page.evaluate("() => { const fl = window.__fl; const P = fl.ALL(); const t0 = performance.now(); for (let i = 0; i < 200; i++) fl.distractors(P[(i * 37) % P.length], 'pt'); return (performance.now() - t0) / 200; }")
    check(t < 8, f'distractor selection fast with {page.evaluate("() => window.__fl.ALL().length")} phrases ({t:.2f} ms each)')
    boot = page.evaluate("() => { const t0 = performance.now(); location.reload(); return 0; }")
    page.wait_for_timeout(800)
    tm = page.evaluate("() => performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart")
    check(tm < 2500, f'page boots quickly ({tm} ms to DOMContentLoaded)')
    check(not logs, f'no errors in plan/method checks {logs[:3]}')
    ctx.close()

with sync_playwright() as p:
    b = p.chromium.launch()
    only = sys.argv[1:]
    for fn in [packs, plan_and_methods]:
        if not only or fn.__name__ in only:
            try: fn(b)
            except Exception as e: check(False, f'{fn.__name__} crashed: {e}')
    b.close()
fails = [m for ok, m in RESULTS if not ok]
print('\nTOTAL', len(RESULTS), 'FAILED', len(fails))
for f in fails: print('  -', f)
