"""Actualiza data/programa.json a partir do programa oficial do Tech Show Madrid 2026.

Corre no GitHub Actions (ver .github/workflows/atualizar-programa.yml) e pode ser corrido à mão:
    python tools/atualizar_programa.py

- Mantém os IDs das sessões (pelo URL oficial; em alternativa dia + sala + hora).
- Sessões que desaparecem do site ficam marcadas como "cancelada" (não são apagadas),
  para a app poder avisar quem estava inscrito.
- Regista alterações de hora, sala, título e oradores.
- Se a leitura do site falhar ou vier incompleta, não altera nada.
"""
import datetime as dt
import html
import json
import os
import re
import sys
import urllib.request

FONTE = 'https://www.techshowmadrid.es/programa-completo'
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(RAIZ, 'data', 'programa.json')
JS_PATH = os.path.join(RAIZ, 'data', 'programa.js')

MIN_SESSOES = 150          # abaixo disto a leitura é considerada falhada
MAX_DESAPARECIDAS = 0.25   # se desaparecerem mais de 25% das sessões, assume-se erro de leitura

SALAS = {  # nome da sala no site → id usado na app
    'Tech Keynote Theatre': 'tech-keynote',
    'AI & Data Theatre': 'ai-data',
    'Cloud & AI Theatre': 'cloud-ai',
    'CSW Theatre': 'cyber-security',
    'Technology for Marketing Theatre': 'tfm',
    'HR & Learning Theatre': 'hr-learning',
    'Talent & Recruitment Theatre': 'hr-talent',
    'Well-Being & Employee Benefits Theatre': 'hr-wellbeing',
    'E-SHOW Keynote Theatre': 'e-show',
    'Ecommerce Strategies Theatre': 'ecommerce-strat',
    'Future Commerce Theatre': 'future-commerce',
    'AI for Commerce Theatre': 'ai-commerce',
    'Prestashop Village': 'prestashop',
    'Design, Build & Investment Theatre': 'dc-design',
    'Edge, Data & AI Solutions Theatre': 'dc-edge',
    'Energy, Sustainability & Renewables Theatre': 'dc-energy',
}
MESES = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8,
         'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}
KW = [('IA', r'\b(IA|AI|inteligencia artificial|artificial intelligence|GenAI|generativ)'), ('agentes', r'agent'),
      ('dados', r'\b(dato|data)\b|datos'), ('marketing', r'marketing|marca|brand|GEO|SEO|contenido|content'),
      ('talento', r'talent|recruit|reclut|selección|empleo'), ('aprendizagem', r'learning|aprendiz|formación|upskill|reskill'),
      ('bem-estar', r'bienestar|well-?being|salud|beneficio'), ('liderança', r'liderazgo|líder|leadership|directiv'),
      ('cibersegurança', r'ciber|cyber|seguridad'), ('cloud', r'cloud|nube'),
      ('e-commerce', r'e-?commerce|retail|tienda|marketplace'), ('ROI', r'\bROI\b|rentab|P&L'),
      ('automatização', r'automatiza|automation')]
CANCELADA_RE = re.compile(r'\b(cancelad[ao]|cancelled|canceled|anulad[ao]|suspendid[ao])\b', re.I)


def limpar(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t))).replace('\x03', ' ').strip()


def ler_site():
    req = urllib.request.Request(FONTE, headers={'User-Agent': 'Mozilla/5.0 (TSM2026 planner)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', errors='replace')


def orador(o, papel):
    t = limpar(o)
    nome, _, resto = t.partition(', ')
    cargo, _, empresa = resto.rpartition(' - ') if ' - ' in resto else (resto, '', '')
    return {'nome': nome.strip(), 'cargo': cargo.strip(), 'empresa': empresa.strip(), 'role': papel}


def parse(pagina):
    # Separadores de dia ("#04-nov-2026") pela ordem em que aparecem
    dias = []
    for d, m, a in re.findall(r'data-tab="#(\d{2})-([a-z]{3})-(\d{4})"', pagina):
        iso = f'{a}-{MESES[m]:02d}-{d}'
        if iso not in dias:
            dias.append(iso)
    blocos = pagina.split('class="m-seminar-list__list"')[1:]
    if not dias or len(blocos) != len(dias):
        raise RuntimeError(f'estrutura inesperada: {len(dias)} dias, {len(blocos)} blocos')
    sessoes = []
    for dia, bloco in zip(dias, blocos):
        itens = re.findall(r'<li class="m-seminar-list__list__items__item[^"]*--session.*?</li>\s*(?=<li class="m-seminar|</ol>)', bloco, re.S)
        for li in itens:
            tm = re.search(r'__title">\s*<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', li, re.S)
            loc = re.search(r'__location">(.*?)</div>', li, re.S)
            horas = re.findall(r'<time datetime="([^"]+)"', li)
            desc = re.search(r'__description">(.*?)</div>', li, re.S)
            if not tm or not loc or len(horas) < 2:
                continue
            sala = limpar(loc.group(1))
            url = tm.group(1)
            url = url if url.startswith('http') else 'https://www.techshowmadrid.es/' + url.lstrip('/')
            descricao = limpar(desc.group(1)) if desc else ''
            if descricao.endswith('...'):
                descricao = descricao[:-3].rstrip(' .') + '…'
            oradores = [orador(o, 'moderador') for o in re.findall(r'__chairperson__name">(.*?)</span>', li, re.S)]
            oradores += [orador(o, 'orador') for o in re.findall(r'__speaker__name">(.*?)</span>', li, re.S)]
            titulo = limpar(tm.group(2))
            sessoes.append({
                'dia': dia, 'sala': sala, 'track_id': SALAS.get(sala, re.sub(r'[^a-z0-9]+', '-', sala.lower()).strip('-')),
                'hora_inicio': horas[0], 'hora_fim': horas[1], 'titulo': titulo,
                'tipo': 'Mesa Debate' if re.search(r'mesa|panel|debate|round ?table', titulo, re.I) else 'Palestra',
                'descricao': descricao, 'oradores': oradores, 'url': url,
                'cancelada_no_site': bool(CANCELADA_RE.search(titulo)),
            })
    return sessoes


def ler_anterior():
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, encoding='utf-8') as f:
            dados = json.load(f)
        if isinstance(dados, dict) and 'sessoes' in dados:
            return dados
    # Primeira execução: parte do programa embutido na app
    js = open(JS_PATH, encoding='utf-8').read()
    tracks = json.loads(js[js.index('const TRACKS = ') + 15:js.index('];', js.index('const TRACKS = ')) + 1])
    ini = js.index('const SESSOES = [') + len('const SESSOES = [')
    sessoes = json.loads('[' + js[ini:js.rindex('];')] + ']')
    return {'versao': 0, 'tracks': tracks, 'sessoes': sessoes}


def chave_sala_hora(s):
    return (s['dia'], s['track_id'], s['hora_inicio'])


def nomes(s):
    return [o['nome'] for o in s.get('oradores', [])]


def main():
    anterior = ler_anterior()
    try:
        novas = parse(ler_site())
    except Exception as e:  # site em baixo ou estrutura mudou: não mexe nos dados
        print(f'Leitura falhou, dados mantidos: {e}')
        return 0
    if len(novas) < MIN_SESSOES:
        print(f'Só {len(novas)} sessões lidas, dados mantidos')
        return 0

    agora = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    ant = [s for s in anterior['sessoes']]
    por_url = {s['url']: s for s in ant}
    por_chave = {chave_sala_hora(s): s for s in ant if s.get('estado') != 'cancelada'}
    usados = set()
    prox = max([int(s['id'][1:]) for s in ant if re.fullmatch(r's\d+', s['id'])] + [0]) + 1

    tracks = {t['id']: t for t in anterior['tracks']}
    resultado, mudancas = [], 0
    for n in novas:
        if n['track_id'] not in tracks:
            tracks[n['track_id']] = {'id': n['track_id'], 'nome': n['sala'], 'cor': '#94a3b8', 'area': n['sala']}
        velho = por_url.get(n['url'])
        if not velho or velho['id'] in usados:
            velho = por_chave.get(chave_sala_hora(n))
            if velho and velho['id'] in usados:
                velho = None
        sessao = {k: n[k] for k in ('dia', 'track_id', 'hora_inicio', 'hora_fim', 'titulo', 'tipo', 'descricao', 'oradores', 'url')}
        if velho:
            usados.add(velho['id'])
            sessao['id'] = velho['id']
            sessao['tags'] = velho.get('tags', [])
            alteracoes = list(velho.get('alteracoes', []))
            novas_alt = []
            if (velho['dia'], velho['hora_inicio'], velho['hora_fim']) != (n['dia'], n['hora_inicio'], n['hora_fim']):
                novas_alt.append({'campo': 'hora', 'antes': f"{velho['dia']} {velho['hora_inicio']}–{velho['hora_fim']}",
                                  'depois': f"{n['dia']} {n['hora_inicio']}–{n['hora_fim']}"})
            if velho['track_id'] != n['track_id']:
                novas_alt.append({'campo': 'sala', 'antes': velho['track_id'], 'depois': n['track_id']})
            if velho['titulo'] != n['titulo']:
                novas_alt.append({'campo': 'titulo', 'antes': velho['titulo'], 'depois': n['titulo']})
            if nomes(velho) != nomes(n):
                novas_alt.append({'campo': 'oradores', 'antes': ', '.join(nomes(velho)) or '—', 'depois': ', '.join(nomes(n)) or '—'})
            for a in novas_alt:
                a['em'] = agora
            sessao['alteracoes'] = alteracoes + novas_alt
            if novas_alt:
                mudancas += 1
            if velho.get('estado') == 'cancelada' and not n['cancelada_no_site']:
                sessao['alteracoes'].append({'campo': 'estado', 'antes': 'cancelada', 'depois': 'reposta', 'em': agora})
                mudancas += 1
        else:
            sessao['id'] = f's{prox:03d}'
            prox += 1
            txt = n['titulo'] + ' ' + n['descricao']
            sessao['tags'] = [k for k, r in KW if re.search(r, txt, re.I)]
            sessao['alteracoes'] = [{'campo': 'estado', 'antes': '—', 'depois': 'nova', 'em': agora}] if anterior['versao'] else []
            mudancas += 1
        if n['cancelada_no_site']:
            sessao['estado'] = 'cancelada'
            if not velho or velho.get('estado') != 'cancelada':
                sessao['alteracoes'].append({'campo': 'estado', 'antes': 'activa', 'depois': 'cancelada', 'em': agora})
        resultado.append(sessao)

    desaparecidas = [s for s in ant if s['id'] not in usados]
    activas_desaparecidas = [s for s in desaparecidas if s.get('estado') != 'cancelada']
    if len(activas_desaparecidas) > MAX_DESAPARECIDAS * len(ant):
        print(f'{len(activas_desaparecidas)} sessões desapareceram de uma vez — assume-se erro de leitura, dados mantidos')
        return 0
    for s in desaparecidas:  # retiradas do site → canceladas
        s = dict(s)
        if s.get('estado') != 'cancelada':
            s['estado'] = 'cancelada'
            s['alteracoes'] = s.get('alteracoes', []) + [{'campo': 'estado', 'antes': 'activa', 'depois': 'cancelada', 'em': agora}]
            mudancas += 1
        resultado.append(s)

    if not mudancas and anterior['versao']:
        print('Sem alterações no programa')
        return 0

    resultado.sort(key=lambda s: (s['dia'], s['hora_inicio'], s['track_id']))
    saida = {
        'fonte': FONTE,
        'versao': anterior['versao'] + 1,
        'actualizado_em': agora,
        'tracks': list(tracks.values()),
        'sessoes': resultado,
    }
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(saida, f, ensure_ascii=False, indent=0)
    print(f'Programa v{saida["versao"]}: {len(resultado)} sessões, {mudancas} alterações')
    return 0


if __name__ == '__main__':
    sys.exit(main())
