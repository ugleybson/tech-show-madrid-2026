"""Lê a lista oficial de expositores do Tech Show Madrid 2026 e gera os dados da vista "Stands".

Uso (à mão, não corre no GitHub Actions):
    python tools/expositores_site.py

1. Lê https://www.techshowmadrid.es/expositores?azletter=A..Z (HTML do servidor, sem login).
   Grava todos os expositores em data/expositores_site.json (nome, slug, stand, patrocínio).
2. Junta a curadoria da equipa (tools/expositores_curadoria.json) com os dados oficiais:
   stand e nome vêm do site (o slug é a chave); o site web vem da página de detalhe.
3. Grava data/expositores.json e data/expositores.js (const EXPOSITORES / CATEGORIAS_EXP).

Se um expositor curado não aparecer no site, o script avisa e mantém o stand da curadoria.
O Swapcard exige login, por isso não é usado.
"""
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.request

BASE = 'https://www.techshowmadrid.es/'
LETRAS = ['0-9'] + [chr(c) for c in range(ord('A'), ord('Z') + 1)]
UA = {'User-Agent': 'Mozilla/5.0 (TSM2026 planner)'}
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_JSON = os.path.join(RAIZ, 'data', 'expositores_site.json')
CURADORIA = os.path.join(RAIZ, 'tools', 'expositores_curadoria.json')
OUT_JSON = os.path.join(RAIZ, 'data', 'expositores.json')
OUT_JS = os.path.join(RAIZ, 'data', 'expositores.js')
MIN_EXPOSITORES = 300  # abaixo disto a leitura é considerada falhada

ITEM_RE = re.compile(r'<li class="m-exhibitors-list__items__item(.*?)</li>', re.S)
SLUG_RE = re.compile(r"openRemoteModal\('exhibitors/([^']+)'")
NOME_RE = re.compile(r'header__title__link[^>]*>(.*?)</a>', re.S)
STAND_RE = re.compile(r'header__meta__stand">\s*Stand:\s*([^<]*?)\s*</div>', re.S)
STATUS_RE = re.compile(r'header__status__item">(.*?)</span>', re.S)
WEB_RE = re.compile(r'contacts__additional__website">.*?<a href=\'([^\']+)\'', re.S)
DESC_RE = re.compile(r'm-exhibitor-entry__item__body__description">(.*?)</div>', re.S)


def limpar(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t or ''))).strip()


def obter(url):
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:  # noqa: BLE001
            if tentativa == 2:
                raise
            print(f'  nova tentativa ({e})', file=sys.stderr)
            time.sleep(2)


def ler_lista():
    todos = {}
    for letra in LETRAS:
        pagina = obter(f'{BASE}expositores?azletter={letra}')
        n = 0
        for bloco in ITEM_RE.findall(pagina):
            slug = SLUG_RE.search(bloco)
            nome = NOME_RE.search(bloco)
            if not slug or not nome:
                continue
            stand = STAND_RE.search(bloco)
            todos[slug.group(1)] = {
                'slug': slug.group(1),
                'nome': limpar(nome.group(1)),
                'stand': limpar(stand.group(1)).upper() if stand else '',
                'patrocinio': ', '.join(limpar(s) for s in STATUS_RE.findall(bloco) if limpar(s)),
            }
            n += 1
        print(f'  {letra}: {n}')
    return sorted(todos.values(), key=lambda e: e['nome'].lower())


def ler_detalhe(slug):
    pagina = obter(f'{BASE}exhibitors/{slug}')
    web = WEB_RE.search(pagina)
    desc = DESC_RE.search(pagina)
    return (web.group(1).strip() if web else ''), limpar(desc.group(1)) if desc else ''


def main():
    print('A ler a lista oficial de expositores...')
    lista = ler_lista()
    if len(lista) < MIN_EXPOSITORES:
        sys.exit(f'Só foram lidos {len(lista)} expositores (mínimo {MIN_EXPOSITORES}). Nada foi alterado.')
    agora = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    with open(SITE_JSON, 'w', encoding='utf-8') as f:
        json.dump({'fonte': BASE + 'expositores', 'actualizado_em': agora, 'expositores': lista},
                  f, ensure_ascii=False, indent=1)
    print(f'{len(lista)} expositores gravados em {os.path.relpath(SITE_JSON, RAIZ)}')

    with open(CURADORIA, encoding='utf-8') as f:
        cur = json.load(f)
    por_slug = {e['slug']: e for e in lista}
    avisos = []
    for e in cur['expositores']:
        oficial = por_slug.get(e['slug'])
        if not oficial:
            avisos.append(f"{e['nome']} ({e['slug']}): não está na lista oficial; stand da curadoria mantido ({e.get('stand')})")
            continue
        if e.get('stand') and oficial['stand'] and e['stand'] != oficial['stand']:
            avisos.append(f"{e['nome']}: stand corrigido {e['stand']} -> {oficial['stand']}")
        e['stand'] = oficial['stand'] or e.get('stand', '')
        e['nome_oficial'] = oficial['nome']
        if oficial['patrocinio']:
            e['patrocinio'] = oficial['patrocinio']
        if not e.get('site'):
            web, desc = ler_detalhe(e['slug'])
            e['site'] = web
            if desc and not e.get('descricao_oficial'):
                e['descricao_oficial'] = desc[:400]
        e['ficha'] = f"{BASE}exhibitors/{e['slug']}"

    versao = int(cur.get('versao', 1))
    saida = {'fonte': BASE + 'expositores', 'versao': versao, 'actualizado_em': agora,
             'perguntas_gerais': cur.get('perguntas_gerais', []),
             'categorias': cur['categorias'], 'expositores': cur['expositores']}
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(saida, f, ensure_ascii=False, indent=1)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('// Gerado por tools/expositores_site.py a partir de tools/expositores_curadoria.json\n')
        f.write(f'const EXPOSITORES_VERSAO = {versao};\n')
        f.write('const PERGUNTAS_GERAIS_EXP = ' + json.dumps(cur.get('perguntas_gerais', []), ensure_ascii=False, indent=1) + ';\n')
        f.write('const CATEGORIAS_EXP = ' + json.dumps(cur['categorias'], ensure_ascii=False, indent=1) + ';\n')
        f.write('const EXPOSITORES = ' + json.dumps(cur['expositores'], ensure_ascii=False, indent=1) + ';\n')
    print(f"{len(cur['expositores'])} expositores curados gravados (versão {versao}).")
    for a in avisos:
        print('  AVISO:', a)


if __name__ == '__main__':
    main()
