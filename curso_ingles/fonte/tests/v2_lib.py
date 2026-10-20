import os, json, random
URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dist', 'fluent_ingles.html')) + '?test'
OUT = os.path.join(os.path.dirname(__file__), 'shots') + '/'
os.makedirs(OUT, exist_ok=True)

FAKE_TTS = """
(() => {
  const voices = [{name:'Fake US Natural', lang:'en-US', voiceURI:'f1', localService:true, default:true},{name:'Fake GB', lang:'en-GB', voiceURI:'f2', localService:true},{name:'Fake AU', lang:'en-AU', voiceURI:'f4', localService:true},{name:'Fake BR', lang:'pt-BR', voiceURI:'f3', localService:true}];
  const synth = { speaking:false, pending:false, paused:false, getVoices:()=>voices, cancel(){ this.speaking=false; }, resume(){}, pause(){},
    speak(u){ this.speaking = true; (window.__spoken = window.__spoken || []).push(u.text); setTimeout(()=>{ this.speaking=false; u.onstart&&u.onstart(); u.onend && u.onend({}); }, 12); },
    addEventListener(){}, onvoiceschanged:null };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function(t){ this.text=t; };
})();
"""
FAKE_SR = """
window.__sayMode = 'right';
class FakeSR { start(){ setTimeout(() => {
    let txt = 'banana phone';
    try {
      const fl = window.__fl;
      if (window.__sayMode === 'right') {
        if (fl.L && !fl.L.finished && fl.L.items[fl.L.i]) txt = fl.L.items[fl.L.i].p.en.replace(/[.!?]/g, '');
        else if (window.__expect) txt = window.__expect;
      }
    } catch (e) {}
    const res = [{ transcript: txt }]; res.isFinal = true;
    this.onresult && this.onresult({ results: [res] }); this.onend && this.onend(); }, 30); }
  stop(){} abort(){} }
window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
"""

def new_page(browser, w=390, hgt=800, mobile=True, clock=False, fake_tts=True, fake_sr=True):
    ctx = browser.new_context(viewport={'width': w, 'height': hgt}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1, accept_downloads=True)
    if fake_tts: ctx.add_init_script(FAKE_TTS)
    if fake_sr: ctx.add_init_script(FAKE_SR)
    page = ctx.new_page()
    logs = []
    page.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
    page.on('console', lambda m: m.type == 'error' and logs.append('CONSOLE ' + m.text))
    if clock: page.clock.install()
    page.goto(URL); page.wait_for_timeout(250)
    return ctx, page, logs

def onboard(page, level_text='Começando do zero', goal_text='Regular', plan_text='Sem prazo'):
    page.get_by_role('button', name='Começar', exact=True).click()
    page.get_by_text(level_text).click()
    page.get_by_role('button', name='Continuar').click()
    page.get_by_text(goal_text).click()
    if plan_text: page.get_by_text(plan_text).click()
    page.get_by_role('button', name='Começar a aprender').click()
    page.wait_for_timeout(150)

def overflow(page):
    return page.evaluate("() => Math.max(document.documentElement.scrollWidth - innerWidth, ...[...document.querySelectorAll('#lessonInner,#stageInner')].map(e => e.offsetParent ? e.scrollWidth - e.clientWidth : 0))")

def cur(page):
    return page.evaluate("""() => { const L = window.__fl.L; if (!L) return null; if (L.finished) return {finished:true};
      const it = L.items[L.i]; if (!it) return null;
      return {type: it.type, en: it.p.en, pt: it.p.pt, a: it.p.a, target: it.p.target, phase: L.phase, cz: window.__fl.clozeTarget(it.p), tiles: window.__fl.tilesOf(it.p)} }""")

CHAINS = []
def play_lesson(page, wrong=0, max_steps=120, shots=None):
    for step in range(max_steps):
        info = cur(page)
        if info is None: return 'closed'
        if info.get('finished'):
            for _ in range(8):
                if page.locator('#lesson').is_hidden(): return 'done'
                if page.get_by_role('button', name='Parar por hoje').count():  # fluency-plan chaining screen
                    CHAINS.append(1); page.get_by_role('button', name='Parar por hoje').click(); page.wait_for_timeout(100); continue
                if page.locator('#mainBtn').count() and page.locator('#mainBtn').is_disabled(): page.locator('.chest').click()
                page.locator('#mainBtn').click(); page.wait_for_timeout(80)
            return 'done' if page.locator('#lesson').is_hidden() else 'stuck'
        if info['phase'] == 'feedback':
            page.locator('#contBtn').click(); continue
        t = info['type']
        do_wrong = wrong > 0 and t in ('read', 'listen', 'build', 'translate', 'mcq', 'pair')
        if shots and step in shots: page.screenshot(path=OUT + shots[step] + '_' + t + '.png')
        if t == 'intro': page.locator('#mainBtn').click(); continue
        if t in ('listen', 'read', 'mcq'):
            target = info['pt'] if t == 'listen' else (info['a'] if t == 'mcq' else info['en'])
            opts = page.locator('.opt')
            for i in range(opts.count()):
                txt = opts.nth(i).locator('span').inner_text()
                if (txt == target) != do_wrong: opts.nth(i).click(); break
        elif t == 'pair':
            opts = page.locator('.pair-opts .opt')
            for i in range(opts.count()):
                if (opts.nth(i).inner_text() == info['target']) != do_wrong: opts.nth(i).click(); break
        elif t == 'build':
            words = info['tiles'] if not do_wrong else list(reversed(info['tiles']))
            for w in words:
                bank = page.locator('.bank .tile:not(.ghosted)')
                for i in range(bank.count()):
                    if bank.nth(i).inner_text() == w: bank.nth(i).click(); break
            page.locator('#mainBtn').click()
        elif t == 'cloze':
            page.locator('.cloze input').fill(info['cz']['text']); page.locator('#mainBtn').click()
        elif t in ('dictation', 'translate'):
            page.locator('textarea.typearea').fill('xyz abc' if do_wrong else info['en']); page.locator('#mainBtn').click()
        elif t in ('speak', 'shadow'):
            page.locator('.mic-btn').click(); page.wait_for_timeout(120)
            if not page.locator('#sheet').is_visible(): page.locator('.mic-btn').click(); page.wait_for_timeout(120)
        if do_wrong: wrong -= 1
        page.wait_for_selector('#sheet:not([hidden])', timeout=4000)
    return 'timeout'

def S(page, expr):
    return page.evaluate("() => { const S = window.__fl.S(); return " + expr + " }")
