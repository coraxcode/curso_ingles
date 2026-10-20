import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from v2_lib import *

RESULTS = []
def check(cond, msg):
    RESULTS.append((bool(cond), msg)); print(('PASS ' if cond else 'FAIL ') + msg)

def run(kind):
    with sync_playwright() as p:
        b = p.chromium.launch()
        mobile = kind == 'mobile'
        ctx, page, logs = new_page(b, *( (375, 740, True) if mobile else (1440, 900, False) ))
        onboard(page)
        check(overflow(page) <= 0, f'[{kind}] home has no horizontal overflow')
        page.screenshot(path=OUT + f'{kind}_home.png')
        # lessons
        for n in range(3):
            page.get_by_role('button', name='Começar lição').first.click(); page.wait_for_timeout(100)
            r = play_lesson(page, wrong=1 if n == 0 else 0, shots={4: f'{kind}_L{n}'} if n == 0 else None)
            check(r == 'done', f'[{kind}] lesson {n} completes')
        st = page.evaluate("() => { const S = window.__fl.S(); return {cards: Object.keys(S.cards).length, coins: S.coins, xp: S.xp, lessons: S.stats.lessons} }")
        check(st['cards'] == 15 and st['coins'] > 0 and st['lessons'] == 3, f'[{kind}] 3 lessons -> 15 cards, coins {st["coins"]}, xp {st["xp"]}')
        # tabs and subs overflow
        for tab in ['review', 'practice', 'quests', 'profile', 'home']:
            page.locator(f'.tab[data-tab="{tab}"]').click(); page.wait_for_timeout(120)
            check(overflow(page) <= 0, f'[{kind}] tab {tab} no overflow')
            page.screenshot(path=OUT + f'{kind}_tab_{tab}.png', full_page=True)
        page.locator('.tab[data-tab="practice"]').click()
        for sub in ['texts', 'talk', 'write', 'sounds', 'listen', 'library']:
            page.evaluate(f"() => window.__fl.openSub('{sub}')"); page.wait_for_timeout(120)
            check(overflow(page) <= 0, f'[{kind}] practice/{sub} no overflow')
            page.screenshot(path=OUT + f'{kind}_sub_{sub}.png', full_page=True)
            page.locator('.sub-head .icon-btn').first.click(); page.wait_for_timeout(80)
            check(page.evaluate("() => window.__fl.SUB") is None, f'[{kind}] back from {sub}')
        # ---- texts: reader + quiz
        page.evaluate("() => window.__fl.openSub('texts')"); page.wait_for_timeout(100)
        page.locator('.titem').first.click(); page.wait_for_timeout(150)
        check(page.locator('#stage').is_visible() and page.locator('.rline').count() >= 5, f'[{kind}] reader opens with lines')
        page.locator('#readerPlay').click(); page.wait_for_timeout(4000)
        spoken = page.evaluate("() => (window.__spoken || []).length")
        check(spoken >= 5, f'[{kind}] reader play-all spoke {spoken} utterances')
        check(page.evaluate("() => !!(window.__fl.S().texts.t01 || {}).listened"), f'[{kind}] text marked as listened')
        page.screenshot(path=OUT + f'{kind}_reader.png')
        check(overflow(page) <= 0, f'[{kind}] reader no overflow')
        page.get_by_role('button', name='Responder').click(); page.wait_for_timeout(150)
        check(page.locator('#lesson').is_visible() and page.locator('#stage').is_hidden(), f'[{kind}] quiz opens in lesson overlay')
        r = play_lesson(page, wrong=1, shots={0: f'{kind}_quiz'})
        check(r == 'done', f'[{kind}] text quiz completes')
        best = page.evaluate("() => (window.__fl.S().texts.t01 || {}).best")
        check(best is not None and best >= 0.6, f'[{kind}] text t01 best={best}')
        # ---- conversation via fake speech
        page.evaluate("() => window.__fl.openSub('talk')"); page.wait_for_timeout(100)
        page.evaluate("() => window.__fl.openTalk(window.__fl.TEXTS.find(t => t.id === 't02'))"); page.wait_for_timeout(300)
        for k in range(30):
            if page.locator('.turn-card').count():
                en = page.evaluate("() => { const t = window.__fl.TEXTS.find(t => t.id === 't02'); const done = document.querySelectorAll('.chat .bubble.me').length; return t.lines.filter(l => l.s === 'B')[done].en }")
                page.evaluate(f"() => {{ window.__expect = {json.dumps(en)}; }}")
                if k == 1:
                    page.locator('.turn-card textarea').fill(en); page.locator('.turn-card .btn', has_text='Enviar').click()
                else:
                    page.locator('.turn-card .mic-btn').click()
                page.wait_for_timeout(250)
            elif page.get_by_role('button', name='Concluir').count():
                break
            else:
                page.wait_for_timeout(150)
        page.screenshot(path=OUT + f'{kind}_talk.png')
        rp = page.evaluate("() => (window.__fl.S().texts.t02 || {}).rp")
        check(rp is not None and rp >= 0.9, f'[{kind}] conversation completed with score {rp}')
        check(overflow(page) <= 0, f'[{kind}] conversation no overflow')
        page.get_by_role('button', name='Concluir').click(); page.wait_for_timeout(150)
        check(page.locator('#stage').is_hidden(), f'[{kind}] conversation closes')
        # ---- writing with typical errors
        page.evaluate("() => window.__fl.openWriting(window.__fl.WRITING.find(w => w.id === 'w04'))"); page.wait_for_timeout(200)
        txt = "Last weekend was great. i have 30 years and people is very nice here. First, I went to the beach with my friends. Then we discuss about music and listen music all afternoon. After that, I didn't went home early. It was the best weekend."
        page.locator('#wbox').fill(txt); page.wait_for_timeout(100)
        chips_ok = page.locator('.wchip.ok').count()
        check(chips_ok >= 4, f'[{kind}] writing chips detected {chips_ok}')
        page.get_by_role('button', name='Concluir e avaliar').click(); page.wait_for_timeout(200)
        fixes = page.locator('.wfix').count()
        check(fixes >= 5, f'[{kind}] writing found {fixes} L1-interference hints')
        page.screenshot(path=OUT + f'{kind}_writing_report.png', full_page=False)
        check(overflow(page) <= 0, f'[{kind}] writing report no overflow')
        page.get_by_role('button', name='Reescrever').click(); page.wait_for_timeout(150)
        check(page.locator('#wbox').input_value() == txt, f'[{kind}] rewrite keeps text')
        page.locator('#stageClose').click(); page.wait_for_timeout(150)
        if page.locator('#modal').is_visible(): page.locator('#modal .btn.bad').click(); page.wait_for_timeout(150)
        check(page.locator('#stage').is_hidden(), f'[{kind}] writing stage closed (with confirm)')
        # ---- sounds round
        page.evaluate("() => window.__fl.startPairs([window.__fl.PAIRS[0]])"); page.wait_for_timeout(150)
        r = play_lesson(page, wrong=1, shots={1: f'{kind}_pair'})
        check(r == 'done', f'[{kind}] sounds round completes')
        pst = page.evaluate("() => window.__fl.S().pairs.ih")
        check(pst and pst['n'] >= 12, f'[{kind}] pair stats recorded {pst and pst["n"]}')
        # ---- quests & shop
        page.locator('.tab[data-tab="quests"]').click(); page.wait_for_timeout(150)
        page.evaluate("() => { const S = window.__fl.S(); window.__fl.ensureQuests(); S.quests.list.forEach(q => { q.prog = q.goal; q.done = true; }); window.__fl.render(); }")
        page.wait_for_timeout(100)
        n = page.get_by_role('button', name='Resgatar').count()
        for _ in range(n):
            page.get_by_role('button', name='Resgatar').first.click(); page.wait_for_timeout(80)
        page.get_by_role('button', name='Abrir baú das missões').click(); page.wait_for_timeout(150)
        page.screenshot(path=OUT + f'{kind}_quest_chest.png')
        page.get_by_role('button', name='Coletar').click(); page.wait_for_timeout(100)
        check(page.evaluate("() => window.__fl.S().quests.bonus") is True, f'[{kind}] quest chest opened')
        page.evaluate("() => { window.__fl.S().coins += 1000; window.__fl.render(); }")
        page.locator('.sitem', has_text='Tema Uva').locator('button').click(); page.wait_for_timeout(100)
        check(page.evaluate("() => document.documentElement.getAttribute('data-accent')") == 'grape', f'[{kind}] theme purchase applies accent')
        fz = page.evaluate("() => window.__fl.S().streak.freezes")
        page.locator('.sitem', has_text='Protetor de sequência').locator('button').click(); page.wait_for_timeout(100)
        check(page.evaluate("() => window.__fl.S().streak.freezes") == min(3, fz + 1), f'[{kind}] freeze purchase')
        page.screenshot(path=OUT + f'{kind}_quests_shop.png', full_page=True)
        # ---- lightning (fast answers)
        page.evaluate("() => window.__fl.openLightning()"); page.wait_for_timeout(100)
        page.locator('#ltStart').click(); page.wait_for_timeout(100)
        for _ in range(14):
            ans = page.evaluate("""() => { const q = document.querySelector('.lt-q span'); if (!q) return null; const t = q.textContent; const P = window.__fl.ALL();
              const p = P.find(x => x.en === t) || P.find(x => x.pt === t); if (!p) return null; return p.en === t ? p.pt : p.en; }""")
            if not ans: break
            opts = page.locator('#stage .opt')
            for i in range(opts.count()):
                if opts.nth(i).locator('span').inner_text() == ans: opts.nth(i).click(); break
        sc = int(page.locator('.lt-score').inner_text())
        check(sc >= 14, f'[{kind}] lightning scoring works ({sc})')
        page.screenshot(path=OUT + f'{kind}_lightning.png')
        page.locator('#stageClose').click(); page.wait_for_timeout(100)
        if page.locator('#modal').is_visible(): page.locator('#modal .btn.bad').click(); page.wait_for_timeout(100)
        check(page.locator('#stage').is_hidden(), f'[{kind}] lightning can be exited mid-game')
        # ---- profile: can-do + share fallback
        page.locator('.tab[data-tab="profile"]').click(); page.wait_for_timeout(100)
        page.locator('.cando input').first.check(); page.wait_for_timeout(80)
        check(page.evaluate("() => Object.values(window.__fl.S().cando).some(o => Object.values(o).some(Boolean))"), f'[{kind}] can-do checkbox saved')
        # reload persistence
        page.reload(); page.wait_for_timeout(300)
        st2 = page.evaluate("() => { const S = window.__fl.S(); return {cards: Object.keys(S.cards).length, accent: S.shop.accent, texts: Object.keys(S.texts).length} }")
        check(st2['cards'] >= 15 and st2['accent'] == 'grape' and st2['texts'] >= 2, f'[{kind}] state persists after reload {st2}')
        check(page.evaluate("() => document.documentElement.getAttribute('data-accent')") == 'grape', f'[{kind}] accent re-applied on boot')
        check(not logs, f'[{kind}] no console/page errors {logs[:5]}')
        b.close()

for k in (sys.argv[1:] or ['mobile', 'desktop']): run(k)
fails = [m for ok, m in RESULTS if not ok]
print('\nTOTAL', len(RESULTS), 'FAILED', len(fails))
for f in fails: print('  -', f)
