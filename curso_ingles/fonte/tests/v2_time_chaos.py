import sys, os, random, datetime
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from v2_lib import *

RESULTS = []
def check(cond, msg):
    RESULTS.append((bool(cond), msg)); print(('PASS ' if cond else 'FAIL ') + msg)

def time_travel(b):
    ctx = b.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, has_touch=True)
    ctx.add_init_script(FAKE_TTS); ctx.add_init_script(FAKE_SR)
    ctx.clock.install(time=datetime.datetime(2026, 10, 19, 10, 0, 0))  # Monday
    page = ctx.new_page(); logs = []
    page.on('pageerror', lambda e: logs.append(str(e)))
    page.goto(URL); page.wait_for_timeout(300)
    onboard(page)
    page.get_by_role('button', name='Começar lição').first.click()
    check(play_lesson(page) == 'done', 'day 1 lesson')
    d1 = page.evaluate("() => { const S = window.__fl.S(); return {streak: S.streak.count, last: S.streak.last, fr: S.streak.freezes, qday: S.quests.day, week: S.quests.week} }")
    check(d1['streak'] == 1 and d1['last'] == '2026-10-19', f'day 1 streak {d1}')
    # gift
    page.locator('.tab[data-tab="home"]').click(); page.wait_for_timeout(100)
    check(page.locator('.gift').count() == 1, 'daily gift visible on day 1')
    page.locator('.gift').click(); page.wait_for_timeout(100)
    coins_after_gift = page.evaluate("() => window.__fl.S().coins")
    page.reload(); page.wait_for_timeout(200)
    check(page.locator('.gift').count() == 0, 'gift not offered twice the same day')
    # day 2
    ctx.clock.fast_forward(24*3600*1000); page.reload(); page.wait_for_timeout(300)
    due = page.evaluate("() => window.__fl.S() && Object.values(window.__fl.S().cards).filter(c => c.due <= Date.now()).length")
    check(due == 5, f'day 2: 5 cards due ({due})')
    check(page.locator('#tabDue').inner_text() == '5', 'review badge shows 5')
    check(page.locator('.gift').count() == 1, 'new gift on day 2')
    q2 = page.evaluate("() => window.__fl.S().quests.day")
    check(q2 == '2026-10-20', f'quests regenerated for day 2 ({q2})')
    page.locator('.tab[data-tab="review"]').click(); page.wait_for_timeout(100)
    page.get_by_role('button', name='Revisar', exact=False).filter(has_text='frases').click()
    check(play_lesson(page) == 'done', 'day 2 review session')
    st = page.evaluate("() => window.__fl.S().streak")
    check(st['count'] == 2, f'streak 2 on day 2 ({st})')
    nxt = page.evaluate("() => Object.values(window.__fl.S().cards).map(c => Math.round((c.due - Date.now()) / 864e5))")
    check(all(x >= 1 for x in nxt), f'FSRS scheduled next reviews in the future {sorted(nxt)}')
    # skip day 3 -> freeze used on day 4
    ctx.clock.fast_forward(48*3600*1000); page.reload(); page.wait_for_timeout(300)
    check(page.evaluate("() => window.__fl.S().streak.count") == 2, 'streak still shown with freeze available')
    page.locator('.tab[data-tab="home"]').click()
    page.get_by_role('button', name='Começar lição').first.click()
    check(play_lesson(page) == 'done', 'day 4 lesson')
    st = page.evaluate("() => ({...window.__fl.S().streak, frozen: window.__fl.S().frozenDays})")
    check(st['count'] == 3 and '2026-10-21' in st['frozen'], f'freeze saved the streak {st}')
    # skip 3 days -> streak resets
    ctx.clock.fast_forward(96*3600*1000); page.reload(); page.wait_for_timeout(300)
    check(page.locator('#topStreak b').inner_text() == '0', 'streak shows 0 after long gap without freezes')
    w = page.evaluate("() => window.__fl.S().quests.week")
    check(w == '2026-10-26', f'weekly quests rolled over to next Monday ({w})')
    page.get_by_role('button', name='Começar lição').first.click()
    check(play_lesson(page) == 'done', 'lesson after long gap')
    check(page.evaluate("() => window.__fl.S().streak.count") == 1, 'streak restarted at 1')
    check(not logs, f'no errors during time travel {logs[:3]}')
    ctx.close()

def chaos(b, seed, w, hgt, steps=500):
    rnd = random.Random(seed)
    ctx, page, logs = new_page(b, w, hgt, mobile=w < 900)
    onboard(page)
    page.on('dialog', lambda d: d.dismiss())
    page.on('filechooser', lambda fc: None)
    words = ['hello', 'I am fine', 'the', '???', '<b>x</b>', 'Olá', '123', 'I have 30 years', '']
    left = 0
    for i in range(steps):
        try:
            r = rnd.random()
            if r < 0.06: page.keyboard.press(rnd.choice(['Escape', 'Enter', '1', '2', '3', ' ', 'Tab']))
            elif r < 0.09: page.go_back(); page.wait_for_timeout(50)
            else:
                els = page.locator('button:visible, .rline:visible, input[type=checkbox]:visible, textarea:visible, input[type=search]:visible, select:visible')
                n = els.count()
                if not n: continue
                el = els.nth(rnd.randrange(n))
                tag = el.evaluate('e => e.tagName')
                txt = (el.inner_text() if tag == 'BUTTON' else '') or ''
                if any(x in txt for x in ['Apagar todo', 'Restaurar backup', 'Importar frases', 'Baixar']): continue
                if tag == 'TEXTAREA' or (tag == 'INPUT' and el.get_attribute('type') == 'search'): el.fill(rnd.choice(words))
                elif tag == 'SELECT':
                    opts = el.locator('option'); k = opts.count()
                    if k: el.select_option(index=rnd.randrange(k))
                else: el.click(timeout=600)
            page.wait_for_timeout(rnd.choice([10, 30, 60, 120]))
        except Exception as e:
            pass
        if not page.url.startswith('file:'):
            left += 1; page.goto(URL); page.wait_for_timeout(200)
    page.wait_for_timeout(600)
    check(not logs, f'chaos seed {seed} ({w}px): no errors after {steps} random actions {logs[:4]}')
    if not page.url.startswith('file:'): page.goto(URL); page.wait_for_timeout(300)
    ok = page.evaluate("() => { try { const S = window.__fl.S(); JSON.stringify(S); return (typeof S.xp === 'number' && !isNaN(S.xp) && !isNaN(S.coins)) || ('bad ' + S.xp + ' ' + S.coins) } catch (e) { return 'err ' + e } }")
    check(ok is True, f'chaos seed {seed}: state valid ({ok})'); print('   left app', left, 'activity', page.evaluate("() => { const S = window.__fl.S(); return {xp: S.xp, coins: S.coins, cards: Object.keys(S.cards).length, lessons: S.stats.lessons} }"))
    ctx.close()

with sync_playwright() as p:
    b = p.chromium.launch()
    if 'time' in sys.argv or len(sys.argv) == 1: time_travel(b)
    if 'chaos' in sys.argv or len(sys.argv) == 1:
        sizes = [(375, 740), (390, 800), (1280, 800), (320, 568)]
        only = [int(a) for a in sys.argv if a.isdigit()]
        for seed, (w, hh) in enumerate(sizes):
            if not only or seed + 1 in only: chaos(b, seed + 1, w, hh)
    b.close()
fails = [m for ok, m in RESULTS if not ok]
print('\nTOTAL', len(RESULTS), 'FAILED', len(fails))
for f in fails: print('  -', f)
