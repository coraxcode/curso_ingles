"""Edge cases: damaged storage, backup round-trip, no voice / no microphone, synonyms, failed cards,
celebrations outside lessons, dark theme, keyboard-only lessons and very small / landscape screens."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from v2_lib import *

RESULTS = []
def check(cond, msg):
    RESULTS.append((bool(cond), msg)); print(('PASS ' if cond else 'FAIL ') + msg, flush=True)

def ctx_page(b, w=390, hgt=800, mobile=True, init=None, tts=True, sr=True, scheme='light'):
    ctx = b.new_context(viewport={'width': w, 'height': hgt}, is_mobile=mobile, has_touch=mobile, accept_downloads=True, color_scheme=scheme)
    if tts: ctx.add_init_script(FAKE_TTS)
    else: ctx.add_init_script("delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; window.speechSynthesis = undefined; window.SpeechSynthesisUtterance = undefined;")
    if sr: ctx.add_init_script(FAKE_SR)
    else: ctx.add_init_script("window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;")
    if init: ctx.add_init_script(init)
    page = ctx.new_page(); logs = []
    page.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
    page.on('console', lambda m: m.type == 'error' and logs.append('CONSOLE ' + m.text))
    page.goto(URL); page.wait_for_timeout(300)
    return ctx, page, logs

def damaged_storage(b):
    for name, raw in [('garbage', 'not json {'), ('wrong types', json.dumps({'v': 3, 'onboarded': True, 'xp': 'lots', 'coins': -5, 'cards': {'F0001': {'s': 'x'}, 'F0036': None, 'F0048': {'s': 2, 'd': 5, 'due': 1, 'last': 0, 'r': 1, 'l': 0}}, 'streak': 'hot', 'quests': {'day': 'x', 'list': [{'id': 'nope', 'goal': 3}]}, 'prefs': {'goal': 'big', 'rate': 99}, 'shop': {'owned': 'all'}, 'stats': None}))]:
        init = "try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('fluent.v3', %s); sessionStorage.setItem('seeded', '1'); } } catch (e) {}" % json.dumps(raw)
        ctx, page, logs = ctx_page(b, init=init)
        st = page.evaluate("() => { const S = window.__fl.S(); return {xp: S.xp, coins: S.coins, cards: Object.keys(S.cards), streak: S.streak.count, goal: S.prefs.goal, rate: S.prefs.rate, q: S.quests.list.map(x => x.id)} }")
        ok = isinstance(st['xp'], (int, float)) and st['coins'] >= 0 and st['streak'] == 0 and st['goal'] > 0 and 0.5 <= st['rate'] <= 1.6
        check(ok and not logs, f'damaged storage ({name}) recovers cleanly {st} {logs[:2]}')
        if name == 'wrong types':
            check(st['cards'] == ['F0048'], 'only valid scheduling records are kept')
            page.locator('.tab[data-tab="quests"]').click(); page.wait_for_timeout(100)
            check(page.locator('.quest').count() >= 3 and not logs, 'quests regenerated from damaged data')
            for tab in ['review', 'practice', 'profile', 'home']:
                page.locator(f'.tab[data-tab="{tab}"]').click(); page.wait_for_timeout(80)
            check(not logs, f'every tab renders with damaged data {logs[:2]}')
        ctx.close()

def backup_roundtrip(b):
    ctx, page, logs = ctx_page(b)
    onboard(page)
    page.get_by_role('button', name='Começar lição').first.click(); play_lesson(page)
    before = page.evaluate("() => { const S = window.__fl.S(); return {cards: Object.keys(S.cards).length, xp: S.xp} }")
    page.locator('.tab[data-tab="profile"]').click(); page.wait_for_timeout(100)
    with page.expect_download() as dl:
        page.get_by_role('button', name='Baixar backup do progresso').click()
    path = dl.value.path(); data = json.load(open(path))
    check(data.get('schema') == 'fluent-backup-v3' and len(data['state']['cards']) == before['cards'], 'backup file has the progress')
    page.get_by_role('button', name='Apagar todo o progresso').click(); page.wait_for_timeout(100)
    page.locator('#modal .btn.bad').click(); page.wait_for_timeout(150)
    check(page.evaluate("() => Object.keys(window.__fl.S().cards).length") == 0, 'reset clears progress')
    with page.expect_file_chooser() as fc:
        page.get_by_role('button', name='Restaurar backup').click()
    fc.value.set_files(path); page.wait_for_timeout(200)
    page.get_by_role('button', name='Restaurar', exact=True).click(); page.wait_for_timeout(200)
    after = page.evaluate("() => { const S = window.__fl.S(); return {cards: Object.keys(S.cards).length, xp: S.xp} }")
    check(after == before, f'restore brings everything back {after}')
    # a v1 backup restore that is cancelled must not change anything
    v1 = os.path.join(OUT, 'v1_backup.json')
    json.dump({'schema': 'english-fluency-backup-v1', 'progress': {'F0001': {'learned': True, 'box': 2, 'due': '2026-01-01'}}}, open(v1, 'w'))
    with page.expect_file_chooser() as fc:
        page.get_by_role('button', name='Restaurar backup').click()
    fc.value.set_files(v1); page.wait_for_timeout(200)
    page.locator('#modal .btn.ghost').click(); page.wait_for_timeout(150)
    again = page.evaluate("() => { const S = window.__fl.S(); return {cards: Object.keys(S.cards).length, xp: S.xp} }")
    check(again == before, f'cancelled old-format restore keeps current progress {again}')
    # broken file
    bad = os.path.join(OUT, 'bad.json'); open(bad, 'w').write('{oops')
    with page.expect_file_chooser() as fc:
        page.get_by_role('button', name='Restaurar backup').click()
    fc.value.set_files(bad); page.wait_for_timeout(200)
    check(page.locator('.toast.err').count() >= 1 and not logs, 'broken backup file shows a friendly error')
    ctx.close()

def no_voice_no_mic(b):
    ctx, page, logs = ctx_page(b, tts=False, sr=False)
    onboard(page)
    for n in range(3):
        page.get_by_role('button', name='Começar lição').first.click(); page.wait_for_timeout(80)
        types = set()
        for _ in range(80):
            info = cur(page)
            if not info or info.get('finished'): break
            types.add(info['type'])
            if play_step(page, info) == 'stop': break
        r = finish_result(page)
        check(r == 'done', f'lesson {n} completes without voice or microphone ({sorted(types)})')
        check(not (types & {'listen', 'dictation', 'speak', 'shadow'}), 'no audio/microphone exercise is offered')
    page.locator('.tab[data-tab="practice"]').click(); page.wait_for_timeout(100)
    for sub in ['texts', 'talk', 'write', 'sounds', 'listen', 'library']:
        page.evaluate(f"() => window.__fl.openSub('{sub}')"); page.wait_for_timeout(100)
        page.locator('.sub-head .icon-btn').first.click(); page.wait_for_timeout(60)
    page.evaluate("() => window.__fl.openTalk(window.__fl.TEXTS.find(t => t.id === 't02'))"); page.wait_for_timeout(1500)
    check(page.locator('.turn-card textarea').count() == 1 and page.locator('.turn-card .mic-btn').count() == 0, 'conversation falls back to typing')
    check(not logs, f'no errors without voice/microphone {logs[:3]}')
    ctx.close()

def play_step(page, info):
    t = info['type']
    if info['phase'] == 'feedback': page.locator('#contBtn').click(); return
    if t == 'intro': page.locator('#mainBtn').click(); return
    if t in ('listen', 'read', 'mcq'):
        target = info['pt'] if t == 'listen' else (info['a'] if t == 'mcq' else info['en'])
        opts = page.locator('.opt')
        for i in range(opts.count()):
            if opts.nth(i).locator('span').inner_text() == target: opts.nth(i).click(); break
    elif t == 'build':
        for w in info['tiles']:
            bank = page.locator('.bank .tile:not(.ghosted)')
            for i in range(bank.count()):
                if bank.nth(i).inner_text() == w: bank.nth(i).click(); break
        page.locator('#mainBtn').click()
    elif t == 'cloze':
        page.locator('.cloze input').fill(info['cz']['text']); page.locator('#mainBtn').click()
    elif t in ('dictation', 'translate'):
        page.locator('textarea.typearea').fill(info['en']); page.locator('#mainBtn').click()
    else:
        return 'stop'
    page.wait_for_selector('#sheet:not([hidden])', timeout=4000)

def finish_result(page):
    for _ in range(8):
        if page.locator('#lesson').is_hidden(): return 'done'
        if page.locator('#mainBtn').count() and page.locator('#mainBtn').is_disabled(): page.locator('.chest').click()
        page.locator('#mainBtn').click(); page.wait_for_timeout(80)
    return 'done' if page.locator('#lesson').is_hidden() else 'stuck'

def learning_logic(b):
    ctx, page, logs = ctx_page(b)
    onboard(page)
    # no option in a choice exercise may mean the same as the answer
    bad = page.evaluate("""() => { const fl = window.__fl; let bad = 0; const P = fl.ALL();
      for (let k = 0; k < 400; k++) { const p = P[(k * 37) % P.length];
        for (const f of ['en', 'pt']) for (const d of fl.distractors(p, f)) { const q = P.find(x => x[f] === d); if (q && (q.pt === p.pt || q.en === p.en)) bad++; } }
      return bad }""")
    check(bad == 0, f'distractors never repeat the meaning of the answer ({bad})')
    # a phrase failed three times still gets a review card (lapse) instead of being forgotten
    page.evaluate("() => { const fl = window.__fl; const u = fl.nextUnit(); fl.startLesson(u.ph.slice(0, 1).map(p => fl.mk('translate', p)), { mode: 'unit', unit: u }); }")
    pid = page.evaluate("() => window.__fl.L.items[0].p.id")
    for k in range(3):
        info = cur(page)
        if not info or info.get('finished'): break
        sel = 'textarea.typearea' if info['type'] in ('translate', 'dictation') else None
        if sel: page.locator(sel).fill('zzz qqq'); page.locator('#mainBtn').click()
        elif info['type'] == 'build':
            bank = page.locator('.bank .tile:not(.ghosted)'); bank.nth(bank.count() - 1).click(); page.locator('#mainBtn').click()
        elif info['type'] in ('read', 'listen'):
            target = info['pt'] if info['type'] == 'listen' else info['en']
            opts = page.locator('.opt')
            for i in range(opts.count()):
                if opts.nth(i).locator('span').inner_text() != target: opts.nth(i).click(); break
        else: break
        page.wait_for_selector('#sheet:not([hidden])', timeout=4000)
        page.locator('#contBtn').click(); page.wait_for_timeout(80)
    card = page.evaluate(f"() => window.__fl.S().cards['{pid}'] || null")
    check(card is not None and card['due'] <= page.evaluate("() => Date.now() + 864e5"), f'phrase failed 3 times is scheduled again soon ({card and card.get("s")})')
    check(page.evaluate("() => { const b = document.querySelector('#lessonBar span'); return parseFloat(b.style.width) <= 100 }"), 'progress bar never passes 100%')
    finish_result(page)
    # reaching the daily goal outside a lesson celebrates right away and not later at a random time
    page.evaluate("() => { const S = window.__fl.S(); S.prefs.goal = 150; window.__fl.render(); }")
    page.locator('.tab[data-tab="practice"]').click(); page.wait_for_timeout(100)
    for _ in range(3):
        page.locator('.imm-btns button', has_text='+60 min').click(); page.wait_for_timeout(120)
    imm = page.evaluate("() => { const S = window.__fl.S(); const k = Object.keys(S.imm)[0]; return {min: S.imm[k], xp: S.xpDay[k]} }")
    check(imm['min'] == 180, f'immersion minutes recorded ({imm})')
    page.wait_for_timeout(800)
    check(page.locator('.toast', has_text='Meta diária cumprida').count() >= 1, 'daily goal toast shown outside a lesson')
    page.evaluate("() => { const fl = window.__fl; const u = fl.nextUnit(); fl.startLesson(fl.buildUnitItems(u), { mode: 'unit', unit: u }); }")
    r = play_lesson(page)
    check(r == 'done', 'next lesson finishes')
    check(page.locator('.celebrate h1', has_text='Meta diária').count() == 0, 'no stale daily-goal screen after the next lesson')
    xp_imm = page.evaluate("() => 0")
    check(not logs, f'no errors in learning-logic checks {logs[:3]}')
    ctx.close()

def keyboard_only(b):
    ctx, page, logs = ctx_page(b, 1280, 800, mobile=False)
    onboard(page)
    page.get_by_role('button', name='Começar lição').first.click(); page.wait_for_timeout(100)
    steps = 0
    for _ in range(120):
        info = cur(page)
        if info is None: break
        if info.get('finished'):
            page.keyboard.press('Enter'); page.wait_for_timeout(120)
            if page.locator('#lesson').is_hidden(): break
            continue
        if info['phase'] == 'feedback': page.keyboard.press('Enter'); page.wait_for_timeout(60); continue
        t = info['type']
        if t == 'intro': page.keyboard.press('Enter')
        elif t in ('listen', 'read'):
            target = info['pt'] if t == 'listen' else info['en']
            opts = page.locator('.opt')
            for i in range(opts.count()):
                if opts.nth(i).locator('span').inner_text() == target: page.keyboard.press(str(i + 1)); break
        elif t == 'cloze': page.keyboard.type(info['cz']['text']); page.keyboard.press('Enter')
        elif t in ('dictation', 'translate'): page.keyboard.type(info['en']); page.keyboard.press('Enter')
        elif t == 'build':
            for w in info['tiles']:
                bank = page.locator('.bank .tile:not(.ghosted)')
                for i in range(bank.count()):
                    if bank.nth(i).inner_text() == w: bank.nth(i).click(); break
            page.keyboard.press('Enter')
        else: page.locator('.mic-btn').click(); page.wait_for_timeout(150)
        steps += 1; page.wait_for_timeout(80)
    check(page.locator('#lesson').is_hidden() and steps > 5, f'lesson can be done with the keyboard ({steps} steps)')
    page.get_by_role('button', name='Começar lição').first.click(); page.wait_for_timeout(100)
    page.keyboard.press('Escape'); page.wait_for_timeout(100)
    check(page.locator('#modal').is_visible(), 'Escape asks before leaving a lesson')
    page.keyboard.press('Escape'); page.wait_for_timeout(100)
    check(page.locator('#lesson').is_visible(), 'Escape on the question keeps the lesson open')
    check(not logs, f'no errors with keyboard {logs[:3]}')
    ctx.close()

def small_screens(b):
    for (w, hh, label) in [(320, 568, '320px'), (740, 360, 'landscape'), (390, 800, 'dark')]:
        ctx, page, logs = ctx_page(b, w, hh, mobile=True, scheme='dark' if label == 'dark' else 'light')
        onboard(page)
        page.get_by_role('button', name='Começar lição').first.click(); play_lesson(page, shots={3: f'v3_{label}_lesson'})
        worst = []
        def chk(name):
            o = overflow(page)
            if o > 0: worst.append((name, o))
            page.screenshot(path=OUT + f'v3_{label}_{name}.png')
        for tab in ['home', 'review', 'practice', 'quests', 'profile']:
            page.locator(f'.tab[data-tab="{tab}"]').click(); page.wait_for_timeout(100); chk('tab_' + tab)
        page.evaluate("() => window.__fl.openReader(window.__fl.TEXTS.find(t => t.id === 't21'), 'read')"); page.wait_for_timeout(150); chk('reader')
        page.locator('#stageClose').click(); page.wait_for_timeout(100)
        page.evaluate("() => window.__fl.openTalk(window.__fl.TEXTS.find(t => t.id === 't29'))"); page.wait_for_timeout(1800); chk('talk')
        page.locator('#stageClose').click(); page.wait_for_timeout(100)
        if page.locator('#modal').is_visible(): page.locator('#modal .btn.bad').click(); page.wait_for_timeout(100)
        page.evaluate("() => window.__fl.openWriting(window.__fl.WRITING.find(w => w.id === 'w21'))"); page.wait_for_timeout(150); chk('writing')
        page.locator('#stageClose').click(); page.wait_for_timeout(100)
        page.evaluate("() => window.__fl.openLightning()"); page.wait_for_timeout(100); page.locator('#ltStart').click(); page.wait_for_timeout(200); chk('lightning')
        page.locator('#stageClose').click(); page.wait_for_timeout(100)
        if page.locator('#modal').is_visible(): page.locator('#modal .btn.bad').click(); page.wait_for_timeout(100)
        check(not worst, f'[{label}] no horizontal overflow on any screen {worst}')
        if label == 'dark':
            bg = page.evaluate("() => getComputedStyle(document.body).backgroundColor")
            check(bg not in ('rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'), f'dark theme applied ({bg})')
        # main buttons stay reachable (inside the viewport) on short screens
        page.locator('.tab[data-tab="home"]').click(); page.wait_for_timeout(100)
        page.get_by_role('button', name='Começar lição').first.click(); page.wait_for_timeout(150)
        box = page.locator('#mainBtn').bounding_box()
        check(box and box['y'] + box['height'] <= hh + 1, f'[{label}] main lesson button visible without scrolling ({box})')
        page.locator('#lessonClose').click(); page.wait_for_timeout(100)
        if page.locator('#modal').is_visible(): page.locator('#modal .btn.bad').click()
        check(not logs, f'[{label}] no errors {logs[:3]}')
        ctx.close()

with sync_playwright() as p:
    b = p.chromium.launch()
    only = sys.argv[1:]
    for fn in [damaged_storage, backup_roundtrip, no_voice_no_mic, learning_logic, keyboard_only, small_screens]:
        if not only or fn.__name__ in only:
            try: fn(b)
            except Exception as e: check(False, f'{fn.__name__} crashed: {e}')
    b.close()
fails = [m for ok, m in RESULTS if not ok]
print('\nTOTAL', len(RESULTS), 'FAILED', len(fails))
for f in fails: print('  -', f)
