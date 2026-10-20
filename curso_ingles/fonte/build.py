#!/usr/bin/env python3
"""Build pipeline for Fluent.
- reads the built-in course (data/course.json, American English) and every language pack in data/packs/*.json
- for each language that wordfreq knows, computes a frequency lexicon (top lemmas + token-mass share) with
  wordfreq + simplemma and attaches to each phrase/text the list of high-frequency lemma indices it contains ("w")
- inlines CSS/JS/data into a single offline HTML file (dist/fluent_ingles.html) and an artifact fragment
- writes the editable JSON of the built-in course and the ready-to-load packs (dist/*.json)
Usage: python3 build.py            (requires: pip install wordfreq simplemma)
"""
import json, re, sys, os, html, glob, base64, unicodedata
from wordfreq import top_n_list, word_frequency
import simplemma

ROOT = os.path.dirname(os.path.abspath(__file__))
LEX_SIZE = 8000
TOK = re.compile(r"[a-zà-ÿœæ]+(?:'[a-zà-ÿœæ]+)?")
WORD_RE = re.compile(r"[a-zà-ÿœæ]+(?:'[a-zà-ÿœæ]+)?")

def lang_short(code): return re.split(r'[-_]', str(code or 'en').lower())[0]

def lemma(w, lang):
    if lang == 'en': w = w.split("'")[0]
    else: w = w.split("'")[-1]
    if not w: return ''
    try: return simplemma.lemmatize(w, lang=lang).lower()
    except Exception: return w.lower()

def build_lexicon(lang):
    """Top LEX_SIZE lemmas of the language with their share of running text. Returns (None, None) if unsupported."""
    try: words = top_n_list(lang, 60000)
    except Exception: return None, None
    if not words: return None, None
    mass, tot = {}, 0.0
    for w in words:
        f = word_frequency(w, lang); tot += f
        if not WORD_RE.fullmatch(w): continue
        l = lemma(w, lang)
        if l: mass[l] = mass.get(l, 0) + f
    order = sorted(mass, key=lambda k: -mass[k])[:LEX_SIZE]
    return order, [round(mass[l] / tot, 7) for l in order]

def phrase_lemmas(text, index, lang):
    s = text.lower().replace('’', "'").replace('‘', "'")
    out = set()
    for t in TOK.findall(s):
        base = t
        if lang == 'en':
            if base.endswith("n't"):
                out.add(index.get('not', -1))
                base = {'wo': 'will', 'ca': 'can', 'sha': 'shall', 'ai': 'be'}.get(base[:-3], base[:-3])
            elif "'" in base:
                head, tail = base.split("'", 1)
                extra = {'m': 'be', 're': 'be', 's': None, 've': 'have', 'll': 'will', 'd': 'would'}.get(tail)
                if extra: out.add(index.get(extra, -1))
                base = head
        elif "'" in base:
            head, tail = base.split("'", 1)       # j'ai, l'école, qu'il -> the clitic and the word
            if head in index: out.add(index[head])
            base = tail
        for cand in (lemma(base, lang), base):
            if cand in index: out.add(index[cand]); break
    out.discard(-1)
    return sorted(out)

def target_key(course):
    code = lang_short(course.get('language', 'en'))
    key = course.get('targetKey') or code
    ph = course.get('phrases') or [{}]
    for k in (key, code, 'en', 'target', 'text'):
        if isinstance(ph[0].get(k), str): return k
    return 'en'

def enrich(course):
    """Adds lexicon + per-phrase/text lemma indices. Works for any language wordfreq supports; otherwise leaves w out."""
    lang = lang_short(course.get('language', 'en-US'))
    key = target_key(course)
    lemmas, mass = build_lexicon(lang)
    if not lemmas:
        print(f'  (sem léxico de frequência para "{lang}": o painel de vocabulário ficará vazio)')
        course.pop('lexicon', None)
        for p in course['phrases']: p.pop('w', None)
        return course
    index = {l: i for i, l in enumerate(lemmas)}
    for p in course['phrases']:
        p['w'] = phrase_lemmas(p[key], index, lang)
    for t in course.get('texts', []):
        ws = set()
        for ln in t['lines']: ws.update(phrase_lemmas(ln.get(key) or ln.get('en', ''), index, lang))
        t['w'] = sorted(ws)
    course['lexicon'] = {'source': f'wordfreq ({lang}) + simplemma', 'lemmas': lemmas, 'mass': mass}
    return course

def coverage_report(course):
    lang = lang_short(course.get('language', 'en-US')); key = target_key(course)
    lex = course.get('lexicon');
    if not lex: return
    known = set()
    for p in course['phrases']: known.update(p.get('w', []))
    n1 = sum(1 for i in known if i < 1000); n3 = sum(1 for i in known if i < 3000)
    print(f'  lemas distintos: {len(known)} · cobre {n1/10:.1f}% dos 1.000 mais frequentes e {n3/30:.1f}% dos 3.000')

def css_compat(css):
    """Add fallbacks so the layout still works on older mobile browsers (Safari 14/15, older Android WebViews)."""
    def inset(m):
        vals = m.group(2).split()
        t, r, b, l = (vals * 4)[:4] if len(vals) == 1 else (vals[0], vals[1], vals[0], vals[1]) if len(vals) == 2 else \
            (vals[0], vals[1], vals[2], vals[1]) if len(vals) == 3 else vals[:4]
        return f'{m.group(1)}top:{t};right:{r};bottom:{b};left:{l};inset:{m.group(2)}'
    css = re.sub(r'([{;])inset:([^;}]+)', inset, css)
    css = re.sub(r'([{;\s])([-a-z]+):([^;{}]*\b100dvh\b[^;{}]*)', lambda m: f'{m.group(1)}{m.group(2)}:{m.group(3).replace("100dvh", "100vh")};{m.group(2)}:{m.group(3)}', css)
    return css

def clean_copy(course):
    """Editable version: computed fields removed."""
    clean = {k: v for k, v in course.items() if k != 'lexicon'}
    clean['phrases'] = [{k: v for k, v in p.items() if k != 'w'} for p in course['phrases']]
    clean['texts'] = [{k: v for k, v in t.items() if k != 'w'} for t in course.get('texts', [])]
    return clean

def main():
    dist = os.path.join(ROOT, 'dist'); os.makedirs(dist, exist_ok=True)
    # ---- built-in course (English) ----
    course = json.load(open(os.path.join(ROOT, 'data', 'course.json'), encoding='utf-8'))
    print('curso embutido:', course.get('title', 'Inglês'), len(course['phrases']), 'frases')
    enrich(course); coverage_report(course)
    data = json.dumps(course, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

    css = css_compat(open(os.path.join(ROOT, 'app', 'style.css'), encoding='utf-8').read())
    F = os.path.join(ROOT, 'fonts')
    faces = [('Bricolage Grotesque', '500 800', 'bricolage-grotesque-latin-wght-normal.woff2'),
             ('Atkinson Hyperlegible', '400', 'atkinson-hyperlegible-latin-400-normal.woff2'),
             ('Atkinson Hyperlegible', '700', 'atkinson-hyperlegible-latin-700-normal.woff2')]
    ff = ''
    for fam, wt, path in faces:
        b64 = base64.b64encode(open(os.path.join(F, path), 'rb').read()).decode()
        ff += f"@font-face{{font-family:'{fam}';font-style:normal;font-display:swap;font-weight:{wt};src:url(data:font/woff2;base64,{b64}) format('woff2')}}\n"
    css = '/* Fonts: Bricolage Grotesque & Atkinson Hyperlegible, SIL Open Font License 1.1 */\n' + ff + css
    js = open(os.path.join(ROOT, 'app', 'app.js'), encoding='utf-8').read()
    mods = ''.join(open(os.path.join(ROOT, 'app', m), encoding='utf-8').read() + '\n' for m in ('mod_engage.js', 'mod_skills.js', 'mod_views.js'))
    assert '/*@MODULES@*/' in js
    js = js.replace('/*@MODULES@*/', mods)
    body = open(os.path.join(ROOT, 'app', 'body.html'), encoding='utf-8').read()

    head = ('<title>Fluent</title>\n'
            '<meta name="claude:viewport-fit-sides" content="cover">\n'
            '<meta name="theme-color" content="#3446F0">\n'
            '<meta name="description" content="Curso de idiomas em frases com repetição espaçada, escuta, ditado, fala e escrita. Inglês embutido; outros idiomas por pacote .json.">\n'
            f'<style>\n{css}\n</style>\n')
    tail = (f'<script type="application/json" id="course-data">{data}</script>\n'
            f'<script>\n{js}\n</script>\n')
    standalone = ('<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n'
                  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content">\n'
                  '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
                  '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n'
                  + head + '</head>\n<body>\n' + body + tail + '</body>\n</html>\n')
    open(os.path.join(dist, 'fluent_ingles.html'), 'w', encoding='utf-8').write(standalone)
    open(os.path.join(dist, 'artifact.html'), 'w', encoding='utf-8').write(head + body + tail)
    open(os.path.join(dist, 'ingles_frases.json'), 'w', encoding='utf-8').write(json.dumps(clean_copy(course), ensure_ascii=False, indent=1))
    print('html bytes', len(standalone.encode()))

    # ---- language packs (loaded by the user from Perfil › Idiomas) ----
    for path in sorted(glob.glob(os.path.join(ROOT, 'data', 'packs', '*.json'))):
        pack = json.load(open(path, encoding='utf-8'))
        name = os.path.splitext(os.path.basename(path))[0]
        print('pacote:', pack.get('title', name), pack.get('language'), len(pack['phrases']), 'frases')
        enrich(pack); coverage_report(pack)
        out = os.path.join(dist, f'curso_{name}.json')
        open(out, 'w', encoding='utf-8').write(json.dumps(pack, ensure_ascii=False, separators=(',', ':')))
        print('  ->', out, os.path.getsize(out), 'bytes')

if __name__ == '__main__':
    main()
