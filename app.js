/* ================================================
   app.js – Tech Show Madrid 2026 Team Planner
   ================================================ */

// ── DATA ─────────────────────────────────────────
// TRACKS e SESSOES (programa oficial completo) vêm de data/programa.js


// ── STATE ─────────────────────────────────────────
const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#ef4444'];
const INITIALS = ['A','B','C','D','E'];

// Dados lidos das credenciais (PDF): pavilhão de acreditação → salas do programa
const CREDENCIAIS = {
  m1: { credencial:'AcreditacionMTS26_MADRID_X12706597_Pedro+Duarte+Oliveira+Monteiro.pdf',
        cargo:'Gerente', pavilhao:'HR', trilhas:['hr-learning','hr-talent','hr-wellbeing'],
        // Roteiro de IA (PDF): ROI, falhas de IA, agentes, Human-in-the-Loop, cultura builder, IA invisível, governança
        prioritarias:['s005','s007','s009','s018','s016','s022','s020'] },
  m2: { credencial:'AcreditacionMTS26_MADRID_J13849432_Fábio+Miguel+Mendes+Ferreira.pdf',
        cargo:'Digital Marketing Specialist', pavilhao:'Technology for Marketing', trilhas:['tfm'] },
  m3: { credencial:'AcreditacionMTS26_MADRID_P13827748_Gleibson+Silva.pdf',
        cargo:'AI Project Manager', pavilhao:'Big Data & AI World', trilhas:['ai-data','tech-keynote'] },
  // Consultor financeiro: investimento primeiro, depois energia/sustentabilidade, depois edge
  m4: { credencial:'AcreditacionMTS26_MADRID_L13788720_Marco+Nunes.pdf',
        cargo:'Consultor Financeiro', pavilhao:'Data Centre World', trilhas:['dc-design','dc-energy','dc-edge'],
        // Sessões sobre investimento: Portugal como porta de entrada, mercado, capital, novo ciclo em Espanha
        prioritarias:['s235','s368','s370','s375'] },
  // Gerente: decisões de negócio com IA, B2B, faturação electrónica e governança
  m5: { credencial:'AcreditacionMTS26_MADRID_A14052857_Celestino+Oliveira.pdf',
        cargo:'Gerente', pavilhao:'E-SHOW', trilhas:['e-show','future-commerce','ecommerce-strat','ai-commerce','prestashop'],
        // Integrar IA, prospecção B2B com IA, factura electrónica, crescer em B2B, venda B2B com IA, rentabilidade, governança de IA
        prioritarias:['s189','s186','s215','s217','s344','s342','s365'] },
};

let state = {
  equipa: JSON.parse(localStorage.getItem('tsm_equipa') || 'null') || [
    {id:'m1', nome:'Pedro Monteiro', inicial:'P', cor:COLORS[0], areas:[], ...CREDENCIAIS.m1},
    {id:'m2', nome:'Fábio Ferreira', inicial:'F', cor:COLORS[1], areas:[], ...CREDENCIAIS.m2},
    {id:'m3', nome:'Gleibson Silva', inicial:'G', cor:COLORS[2], areas:[], ...CREDENCIAIS.m3},
    {id:'m4', nome:'Marco Nunes', inicial:'M', cor:COLORS[3], areas:[], ...CREDENCIAIS.m4},
    {id:'m5', nome:'Celestino Oliveira', inicial:'C', cor:COLORS[4], areas:[], ...CREDENCIAIS.m5},
  ],
  inscricoes: JSON.parse(localStorage.getItem('tsm_inscricoes') || '{}'), // {sessaoId: [membroId,...]}
  diaAtivo: '2026-11-04',
  view: 'grid', // grid | timeline
  filtroTrack: '',
  filtroMembro: '',
  filtroTipo: '',
  pesquisa: '',
  sort: 'hora',
  sessaoAberta: null,
  eu: lerLocal('tsm_eu'),   // membro "eu sou" usado em Meu plano (por dispositivo)
  indTab: 'crono',          // telemóvel: separador do plano individual (crono | grelha)
  agoraSim: 630,            // vista Agora fora dos dias do evento: hora simulada (minutos)
  programa: { versao: 0, actualizado_em: null, verificado_em: null },
  // Stands: {expId: {membros?, dia?, visitado, followup, contacto, notas, em}} (por dispositivo)
  visitas: (() => { try { return JSON.parse(localStorage.getItem('tsm_visitas') || '{}'); } catch (e) { return {}; } })(),
  expDia: 'dia',   // dia | todos
  expPrio: '',     // '' | A | B | C
  expCat: '',
  expAberto: null,
  pergLang: lerLocal('tsm_perg_lang') === 'en' ? 'en' : 'pt',  // língua das perguntas nos stands
};

function lerLocal(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function gravarLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// Programa: se houver uma versão mais recente descarregada, usa-a já (antes da migração das inscrições)
carregarProgramaGuardado();

// Migração: aplicar dados reais a equipas já guardadas no localStorage
(function migrateEquipa() {
  const antigos = { m1:'Membro 1', m2:'Membro 2', m3:'Membro 3', m4:'Membro 4', m5:'Membro 5' };
  const nomes = { m1:'Pedro Monteiro', m2:'Fábio Ferreira', m3:'Gleibson Silva', m4:'Marco Nunes', m5:'Celestino Oliveira' };
  state.equipa.forEach(m => {
    const c = CREDENCIAIS[m.id];
    if (!c) return;
    // Sem credencial guardada = membro ainda do tempo do placeholder: recebe o nome real
    if (m.nome === antigos[m.id] || !m.credencial || /^membro \d$/i.test(m.nome.trim())) { m.nome = nomes[m.id]; m.inicial = m.nome.charAt(0).toUpperCase(); }
    Object.assign(m, { credencial: m.credencial || c.credencial, cargo: c.cargo, pavilhao: c.pavilhao, trilhas: c.trilhas, prioritarias: c.prioritarias || [] });
  });
  // Sessões antigas que não existem no programa oficial (placeholders / hora errada)
  const remap = { s040: 's102' };
  Object.keys(state.inscricoes).forEach(id => {
    if (SESSOES.some(x => x.id === id)) return;
    if (remap[id]) state.inscricoes[remap[id]] = [...new Set([...(state.inscricoes[remap[id]] || []), ...state.inscricoes[id]])];
    delete state.inscricoes[id];
  });
})();

// ── SAVE / LOAD ───────────────────────────────────
function saveState() {
  localStorage.setItem('tsm_equipa', JSON.stringify(state.equipa));
  localStorage.setItem('tsm_inscricoes', JSON.stringify(state.inscricoes));
  gravarLocal('tsm_visitas', JSON.stringify(state.visitas));
}

// ── HELPERS ───────────────────────────────────────
function getTrack(id) { return TRACKS.find(t => t.id === id) || {nome:id, cor:'#6366f1'}; }
function getMembro(id) { return state.equipa.find(m => m.id === id); }
function getSessoesMembro(memId) {
  return SESSOES.filter(s => (state.inscricoes[s.id] || []).includes(memId));
}
function getAssignedMembers(sessaoId) {
  return (state.inscricoes[sessaoId] || []).map(mid => getMembro(mid)).filter(Boolean);
}

function toggleInscricao(sessaoId, membroId) {
  if (!state.inscricoes[sessaoId]) state.inscricoes[sessaoId] = [];
  const idx = state.inscricoes[sessaoId].indexOf(membroId);
  if (idx === -1) {
    state.inscricoes[sessaoId].push(membroId);
    return true;
  } else {
    state.inscricoes[sessaoId].splice(idx, 1);
    return false;
  }
}

// ── PROGRAMA EM DIRECTO ───────────────────────────
// O site oficial não permite leitura directa pelo browser (sem CORS). Um robô no GitHub
// (tools/atualizar_programa.py, a cada 5–30 min) lê o site e publica data/programa.json;
// a app vai buscar esse ficheiro.
const PROGRAMA_FONTES = [
  'https://raw.githubusercontent.com/ugleybson/tech-show-madrid-2026/main/data/programa.json',
  'data/programa.json',
];
const CAMPOS_RELEVANTES = ['hora', 'sala', 'estado'];

function ativa(s) { return s.estado !== 'cancelada'; }
function alteracoesRelevantes(s) {
  return (s.alteracoes || []).filter(a => CAMPOS_RELEVANTES.includes(a.campo) && a.depois !== 'nova');
}
function fmtDataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function descreverAlteracao(a) {
  if (a.campo === 'estado') return a.depois === 'cancelada' ? '❌ Cancelada' : a.depois === 'reposta' ? '✅ Reposta' : '🆕 Nova sessão';
  if (a.campo === 'sala') return `🚪 Sala: ${getTrack(a.antes).nome} → ${getTrack(a.depois).nome}`;
  if (a.campo === 'hora') return `🕒 Hora: ${a.antes.slice(11)} → ${a.depois.slice(11)}${a.antes.slice(0,10) !== a.depois.slice(0,10) ? ' (mudou de dia)' : ''}`;
  if (a.campo === 'titulo') return `✏️ Título: «${a.antes}» → «${a.depois}»`;
  if (a.campo === 'oradores') return `🎤 Oradores: ${a.antes} → ${a.depois}`;
  return `${a.campo}: ${a.antes} → ${a.depois}`;
}

// Substitui TRACKS/SESSOES pelos dados novos e devolve as diferenças face aos actuais
function aplicarPrograma(dados) {
  const antes = new Map(SESSOES.map(s => [s.id, s]));
  const dif = { canceladas: [], alteradas: [], novas: [], repostas: [] };
  dados.sessoes.forEach(n => {
    const v = antes.get(n.id);
    if (!v) { if (ativa(n)) dif.novas.push(n); return; }
    if (ativa(v) && !ativa(n)) dif.canceladas.push(n);
    else if (!ativa(v) && ativa(n)) dif.repostas.push(n);
    else if (ativa(n)) {
      const campos = [];
      if (v.dia !== n.dia || v.hora_inicio !== n.hora_inicio || v.hora_fim !== n.hora_fim)
        campos.push({ campo: 'hora', antes: `${v.dia} ${v.hora_inicio}–${v.hora_fim}`, depois: `${n.dia} ${n.hora_inicio}–${n.hora_fim}` });
      if (v.track_id !== n.track_id) campos.push({ campo: 'sala', antes: v.track_id, depois: n.track_id });
      if (v.titulo !== n.titulo) campos.push({ campo: 'titulo', antes: v.titulo, depois: n.titulo });
      const no = x => x.oradores.map(o => o.nome).join(', ');
      if (no(v) !== no(n)) campos.push({ campo: 'oradores', antes: no(v) || '—', depois: no(n) || '—' });
      if (campos.length) dif.alteradas.push({ s: n, campos });
    }
  });
  TRACKS.splice(0, TRACKS.length, ...dados.tracks);
  SESSOES.splice(0, SESSOES.length, ...dados.sessoes);
  state.programa = { versao: dados.versao, actualizado_em: dados.actualizado_em, verificado_em: new Date().toISOString() };
  if (typeof EXPOSITORES !== 'undefined') ligarExpositoresSessoes(); // oradores podem ter mudado
  return dif;
}

function programaGuardado() {
  try { return JSON.parse(localStorage.getItem('tsm_programa') || 'null'); } catch (e) { return null; }
}

// Ao arrancar: usa a última versão descarregada se for mais recente que a embutida
function carregarProgramaGuardado() {
  const g = programaGuardado();
  if (g && g.dados && g.dados.versao > 0) {
    aplicarPrograma(g.dados);
    state.programa.verificado_em = g.verificado_em;
  }
}

async function obterProgramaRemoto() {
  let ultimoErro;
  for (const url of PROGRAMA_FONTES) {
    try {
      const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const dados = await r.json();
      if (!dados || !Array.isArray(dados.sessoes) || !dados.sessoes.length) throw new Error('ficheiro inválido');
      return dados;
    } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro;
}

let aActualizar = false;
async function atualizarPrograma(manual) {
  if (aActualizar) return;
  aActualizar = true;
  document.querySelectorAll('[data-refresh]').forEach(b => b.classList.add('is-loading'));
  try {
    const dados = await obterProgramaRemoto();
    const agora = new Date().toISOString();
    if (dados.versao > (state.programa.versao || 0)) {
      const dif = aplicarPrograma(dados);
      state.programa.verificado_em = agora;
      gravarLocal('tsm_programa', JSON.stringify({ dados, verificado_em: agora }));
      renderTrackFilter();
      renderAll();
      const afectadas = sessoesAfectadas(dif);
      const total = dif.canceladas.length + dif.alteradas.length + dif.novas.length + dif.repostas.length;
      if (manual || afectadas.length) mostrarAlteracoes(dif);
      else showToast(`🔄 Programa actualizado (${total} alterações)`);
    } else {
      state.programa.verificado_em = agora;
      const g = programaGuardado();
      if (g) { g.verificado_em = agora; gravarLocal('tsm_programa', JSON.stringify(g)); }
      renderEstadoPrograma();
      if (manual) showToast(`✅ Programa em dia · última alteração ${fmtDataHora(state.programa.actualizado_em)}`);
    }
  } catch (e) {
    if (manual) showToast(navigator.onLine === false ? '📴 Sem ligação — a usar o programa guardado' : '⚠️ Não foi possível verificar agora. Tente novamente.');
  } finally {
    aActualizar = false;
    document.querySelectorAll('[data-refresh]').forEach(b => b.classList.remove('is-loading'));
  }
}

// Alterações que tocam sessões onde alguém da equipa está inscrito
function sessoesAfectadas(dif) {
  const todas = [...dif.canceladas, ...dif.alteradas.filter(a => a.campos.some(c => CAMPOS_RELEVANTES.includes(c.campo))).map(a => a.s)];
  return todas.filter(s => getAssignedMembers(s.id).length);
}

function renderEstadoPrograma() {
  const el = document.getElementById('programa-estado');
  if (!el) return;
  const p = state.programa;
  const canceladas = SESSOES.filter(s => !ativa(s)).length;
  el.innerHTML = `
    <div>Última alteração: <strong>${p.versao ? fmtDataHora(p.actualizado_em) : 'programa de 13/10'}</strong></div>
    <div>Verificado: ${p.verificado_em ? fmtDataHora(p.verificado_em) : 'ainda não'}${canceladas ? ` · <span class="txt-danger">${canceladas} cancelada${canceladas > 1 ? 's' : ''}</span>` : ''}</div>`;
}

function mostrarAlteracoes(dif) {
  const afectadas = new Set(sessoesAfectadas(dif).map(s => s.id));
  const linha = (s, detalhe) => {
    const tr = getTrack(s.track_id);
    const quem = getAssignedMembers(s.id);
    return `
      <li class="chg ${afectadas.has(s.id) ? 'chg--hit' : ''}" data-session-id="${s.id}" style="--tc:${tr.cor}">
        <div class="chg__title">${s.titulo}</div>
        <div class="chg__meta">${s.dia === '2026-11-04' ? '4 Nov' : '5 Nov'} · ${s.hora_inicio}–${s.hora_fim} · <span style="color:${tr.cor}">${tr.nome}</span></div>
        ${detalhe ? `<div class="chg__detail">${detalhe}</div>` : ''}
        ${quem.length ? `<div class="chg__who">⚠️ No plano de: ${quem.map(m => `<b style="color:${m.cor}">${m.nome}</b>`).join(', ')}</div>` : ''}
      </li>`;
  };
  const ordenar = arr => arr.sort((a,b) => (afectadas.has(b.id) - afectadas.has(a.id)) || (a.dia + a.hora_inicio).localeCompare(b.dia + b.hora_inicio));
  const alteradas = dif.alteradas.map(a => a.s);
  const detalheAlt = new Map(dif.alteradas.map(a => [a.s.id, a.campos.map(descreverAlteracao).join('<br>')]));
  const grupos = [
    ['❌ Canceladas', ordenar(dif.canceladas), () => ''],
    ['🕒 Alteradas', ordenar(alteradas), s => detalheAlt.get(s.id)],
    ['✅ Repostas', ordenar(dif.repostas), () => ''],
    ['🆕 Novas', ordenar(dif.novas), () => ''],
  ].filter(g => g[1].length);
  const precisaAjuste = state.equipa.some(m => { const p = problemasPlano(m); return p.canceladas || p.sobreposicoes; });

  document.getElementById('modal-changes-body').innerHTML = `
    <p class="chg-intro">Fonte: programa oficial · última alteração ${fmtDataHora(state.programa.actualizado_em)}</p>
    ${precisaAjuste ? `<button class="btn-primary w-full" data-ajustar>🔁 Ajustar planos (canceladas e sobreposições)</button>` : ''}
    ${grupos.map(([t, arr, det]) => `
      <h3 class="chg-group">${t} <span>${arr.length}</span></h3>
      <ol class="chg-list">${arr.map(s => linha(s, det(s))).join('')}</ol>`).join('')
      || '<p class="chg-intro">Sem alterações.</p>'}`;

  const body = document.getElementById('modal-changes-body');
  body.querySelectorAll('[data-session-id]').forEach(el => el.addEventListener('click', () => {
    fecharModal('modal-changes');
    openSessionModal(el.dataset.sessionId);
  }));
  body.querySelectorAll('[data-ajustar]').forEach(b => b.addEventListener('click', executarAjuste));
  document.getElementById('modal-changes').classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('is-open');
  document.body.style.overflow = '';
}

// Problemas no plano de um membro: sessões canceladas e sobreposições de horário
function problemasPlano(m) {
  const ss = getSessoesMembro(m.id);
  const ativas = ss.filter(ativa).sort((a,b) => (a.dia + a.hora_inicio).localeCompare(b.dia + b.hora_inicio));
  let sobreposicoes = 0;
  for (let i = 0; i < ativas.length - 1; i++) if (sobrepoe(ativas[i], ativas[i+1])) sobreposicoes++;
  return { canceladas: ss.filter(s => !ativa(s)).length, sobreposicoes };
}

// Ajusta os planos depois de uma alteração ao programa:
// 1) sai das sessões canceladas; 2) nas sobreposições fica com a mais importante
// (prioritária do membro > IA > resto; "TBC" é a primeira a sair);
// 3) tenta preencher cada horário libertado com uma alternativa das salas do membro.
function ajustarPlanos() {
  let removidas = 0, adicionadas = 0;
  state.equipa.forEach(m => {
    const sair = id => { state.inscricoes[id] = (state.inscricoes[id] || []).filter(x => x !== m.id); removidas++; };
    const peso = s => ((m.prioritarias || []).includes(s.id) ? 4 : 0) + (s.tags.includes('IA') ? 2 : 0) - (/^\s*TBC\s*$/i.test(s.titulo) ? 3 : 0);
    const libertados = [];
    getSessoesMembro(m.id).filter(s => !ativa(s)).forEach(c => { sair(c.id); libertados.push(c); });
    for (;;) {
      const ss = getSessoesMembro(m.id).filter(ativa).sort((a,b) => (a.dia + a.hora_inicio).localeCompare(b.dia + b.hora_inicio));
      const i = ss.findIndex((s, k) => k < ss.length - 1 && sobrepoe(s, ss[k+1]));
      if (i === -1) break;
      const [a, b] = [ss[i], ss[i+1]];
      const perde = peso(a) > peso(b) ? b : peso(b) > peso(a) ? a : b;
      sair(perde.id);
      libertados.push(perde);
    }
    const salas = m.trilhas && m.trilhas.length ? m.trilhas : TRACKS.map(t => t.id);
    libertados.forEach(c => {
      const plano = getSessoesMembro(m.id).filter(ativa);
      const alt = SESSOES
        .filter(s => ativa(s) && s.id !== c.id && salas.includes(s.track_id) && sobrepoe(s, c)
          && !plano.some(p => sobrepoe(p, s)) && !NAO_PLANEAR.test(s.titulo))
        .sort((a,b) => peso(b) - peso(a) || salas.indexOf(a.track_id) - salas.indexOf(b.track_id))[0];
      if (alt) { (state.inscricoes[alt.id] = state.inscricoes[alt.id] || []).push(m.id); adicionadas++; }
    });
  });
  return { removidas, adicionadas };
}

function executarAjuste() {
  const r = ajustarPlanos();
  saveState();
  renderAll();
  fecharModal('modal-changes');
  showToast(r.removidas
    ? `🔁 ${r.removidas} sessão(ões) retirada(s), ${r.adicionadas} alternativa(s) adicionada(s) — confira em Meu plano`
    : '✅ Os planos já não têm canceladas nem sobreposições');
}

function badgesSessao(s) {
  if (!ativa(s)) return '<span class="badge-st badge-st--cancel">Cancelada</span>';
  const rel = alteracoesRelevantes(s);
  if (rel.length) return `<span class="badge-st badge-st--changed" title="${rel.map(descreverAlteracao).join(' | ').replace(/"/g,'&quot;')}">Alterada</span>`;
  return '';
}

// ── PLANO PELA CREDENCIAL ─────────────────────────
function sobrepoe(a, b) {
  return a.dia === b.dia && a.hora_inicio < b.hora_fim && b.hora_inicio < a.hora_fim;
}

// Momentos logísticos que não entram no plano automático
const NAO_PLANEAR = /^(check-in|institutional welcome|conclusi[oó]n)\b/i;

// Escolhe sessões sem sobreposições: primeiro as prioritárias do membro (pela ordem dada),
// depois as das salas do pavilhão – as de IA antes das restantes, pela ordem das salas.
function planearPorCredencial(m) {
  if (!m.trilhas || !m.trilhas.length) return 0;
  Object.values(state.inscricoes).forEach(arr => {
    const i = arr.indexOf(m.id);
    if (i !== -1) arr.splice(i, 1);
  });
  const prioritarias = (m.prioritarias || []).map(id => SESSOES.find(s => s.id === id)).filter(s => s && ativa(s));
  const prio = s => (s.tags.includes('IA') ? 0 : 100) + m.trilhas.indexOf(s.track_id);
  const candidatos = SESSOES
    .filter(s => ativa(s) && m.trilhas.includes(s.track_id) && !NAO_PLANEAR.test(s.titulo))
    .sort((a,b) => prio(a) - prio(b) || a.dia.localeCompare(b.dia) || a.hora_inicio.localeCompare(b.hora_inicio));
  const escolhidas = [];
  [...prioritarias, ...candidatos].forEach(s => {
    if (!escolhidas.some(e => sobrepoe(e, s))) escolhidas.push(s);
  });
  escolhidas.forEach(s => {
    if (!state.inscricoes[s.id]) state.inscricoes[s.id] = [];
    state.inscricoes[s.id].push(m.id);
  });
  return escolhidas.length;
}

function planearEquipaPorCredencial() {
  const comCredencial = state.equipa.filter(m => m.trilhas && m.trilhas.length);
  if (!confirm(`Gerar o plano de ${comCredencial.map(m => m.nome).join(', ')} a partir das credenciais?\nAs inscrições actuais destes membros serão substituídas.`)) return;
  comCredencial.forEach(planearPorCredencial);
  saveState();
  renderAll();
  showToast('🎫 Planos individuais gerados pelas credenciais');
}

function filteredSessoes() {
  let list = SESSOES.filter(s => s.dia === state.diaAtivo);
  if (state.filtroTrack) list = list.filter(s => s.track_id === state.filtroTrack);
  if (state.filtroTipo) list = list.filter(s => s.tipo === state.filtroTipo);
  if (state.filtroMembro) {
    list = list.filter(s => (state.inscricoes[s.id] || []).includes(state.filtroMembro));
  }
  if (state.pesquisa.trim()) {
    const q = state.pesquisa.trim().toLowerCase();
    list = list.filter(s =>
      s.titulo.toLowerCase().includes(q) ||
      s.descricao.toLowerCase().includes(q) ||
      s.oradores.some(o => o.nome.toLowerCase().includes(q) || o.empresa.toLowerCase().includes(q)) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    );
  }
  if (state.sort === 'track') {
    list.sort((a,b) => a.track_id.localeCompare(b.track_id) || a.hora_inicio.localeCompare(b.hora_inicio));
  } else {
    list.sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }
  return list;
}

// ── RENDERS ───────────────────────────────────────

// --- Team sidebar ---
function renderTeam() {
  const el = document.getElementById('team-list');
  const filterEl = document.getElementById('filter-member');

  el.innerHTML = state.equipa.map(m => {
    const count = Object.values(state.inscricoes).filter(arr => arr.includes(m.id)).length;
    const isActive = state.filtroMembro === m.id;
    return `
      <div class="team-member ${isActive ? 'active' : ''}" 
           style="color:${m.cor}" 
           data-member-id="${m.id}" 
           id="team-member-${m.id}">
        <div class="team-member__avatar" style="background:${m.cor}; box-shadow:0 0 10px ${m.cor}55">
          ${m.inicial}
        </div>
        <div class="team-member__info">
          <div class="team-member__name">${m.nome}</div>
          <div class="team-member__count">${count} sessão${count !== 1 ? 'ões' : ''}</div>
          ${m.credencial ? `<a class="team-member__cred" href="${encodeURI(m.credencial)}" target="_blank" rel="noopener" title="Abrir credencial">🎫 ${m.pavilhao || 'Credencial'}</a>` : ''}
        </div>
        <div class="team-member__dot"></div>
      </div>`;
  }).join('');

  // Events
  el.querySelectorAll('.team-member__cred').forEach(a => {
    a.addEventListener('click', e => e.stopPropagation());
  });
  el.querySelectorAll('.team-member').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.memberId;
      state.filtroMembro = state.filtroMembro === id ? '' : id;
      document.getElementById('filter-member').value = state.filtroMembro;
      renderAll();
    });
  });

  // Also update filter dropdown
  filterEl.innerHTML = `<option value="">Todos os Membros</option>` +
    state.equipa.map(m => `<option value="${m.id}" ${state.filtroMembro===m.id?'selected':''}>${m.nome}</option>`).join('');
}

// --- Track filter ---
function renderTrackFilter() {
  const el = document.getElementById('filter-track');
  el.innerHTML = `<option value="">Todas as Tracks</option>` +
    TRACKS.map(t => `<option value="${t.id}" ${state.filtroTrack===t.id?'selected':''}>${t.nome}</option>`).join('');
}

// --- Summary ---
function renderSummary() {
  const total = Object.values(state.inscricoes).filter(arr => arr.length > 0).length;
  const conflitos = detectConflicts();
  const el = document.getElementById('summary-stats');
  el.innerHTML = `
    <div class="summary-stat">
      <span class="summary-stat__label">Total inscrito</span>
      <span class="summary-stat__value">${total}</span>
    </div>
    <div class="summary-stat">
      <span class="summary-stat__label">Conflitos hora</span>
      <span class="summary-stat__value" style="color:${conflitos > 0 ? '#ef4444' : '#10b981'}">${conflitos}</span>
    </div>
    <div class="summary-stat">
      <span class="summary-stat__label">Dias cobertos</span>
      <span class="summary-stat__value">2</span>
    </div>
    <div class="summary-stat">
      <span class="summary-stat__label">Stands visitados</span>
      <span class="summary-stat__value">${EXPOSITORES.filter(e => visita(e).visitado).length}/${EXPOSITORES.filter(e => membrosExp(e).length).length}</span>
    </div>
    <div class="summary-stat">
      <span class="summary-stat__label">Follow-ups</span>
      <span class="summary-stat__value" style="color:var(--color-warning)">${EXPOSITORES.filter(e => visita(e).followup).length}</span>
    </div>`;
}

function detectConflicts() {
  let c = 0;
  state.equipa.forEach(m => {
    const sessoes = getSessoesMembro(m.id).filter(ativa)
      .sort((a,b) => (a.dia + a.hora_inicio).localeCompare(b.dia + b.hora_inicio));
    for (let i = 0; i < sessoes.length - 1; i++) {
      if (sessoes[i].dia === sessoes[i+1].dia && sessoes[i].hora_fim > sessoes[i+1].hora_inicio) c++;
    }
  });
  return c;
}

// --- Session cards ---
function renderSessions() {
  const container = document.getElementById('sessions-container');
  if (state.view === 'expositores') { renderExpositores(container); return; }
  const list = filteredSessoes();

  document.getElementById('search-count').textContent = `${list.length} sessões`;

  if (list.length === 0 && state.view !== 'individual' && state.view !== 'agora') {
    container.innerHTML = `
      <div class="no-results">
        <div class="no-results__icon">🔍</div>
        <div class="no-results__text">Nenhuma sessão encontrada com os filtros actuais.</div>
      </div>`;
    return;
  }

  if (state.view === 'agora') {
    renderAgora(container);
  } else if (state.view === 'individual') {
    renderIndividual(container);
  } else if (state.view === 'grid') {
    container.className = 'sessions-container';
    container.innerHTML = list.map(s => renderCard(s)).join('');
  } else {
    renderTimeline(container, list);
  }

  // Card click events
  container.querySelectorAll('[data-session-id]').forEach(el => {
    el.addEventListener('click', () => openSessionModal(el.dataset.sessionId));
  });
}

function renderCard(s) {
  const track = getTrack(s.track_id);
  const assigned = getAssignedMembers(s.id);
  const isAssigned = assigned.length > 0;
  const avatarsHtml = assigned.map(m =>
    `<div class="session-card__avatar" style="background:${m.cor}" title="${m.nome}">${m.inicial}</div>`
  ).join('');
  const speakerNames = s.oradores.map(o => o.nome + (o.empresa ? ` (${o.empresa})` : '')).join(', ');

  return `
    <div class="session-card ${isAssigned ? 'is-assigned' : ''} ${ativa(s) ? '' : 'is-cancelled'}" 
         style="--track-color:${track.cor}" 
         data-session-id="${s.id}"
         id="card-${s.id}">
      <div class="session-card__top">
        <div class="session-card__track-badge" style="color:${track.cor}; border-color:${track.cor}44; background:${track.cor}11">
          ${track.nome}
        </div>
        <div class="session-card__time">${s.hora_inicio}–${s.hora_fim}</div>
      </div>
      ${badgesSessao(s)}
      <div class="session-card__title">${s.titulo}</div>
      ${speakerNames ? `<div class="session-card__speakers">🎤 ${speakerNames}</div>` : ''}
      <div class="session-card__bottom">
        <span class="session-card__type-badge">${s.tipo}</span>
        <div class="session-card__avatars">${avatarsHtml}</div>
      </div>
    </div>`;
}

function renderTimeline(container, list) {
  container.className = 'sessions-container view-timeline';
  const grouped = {};
  list.forEach(s => {
    const h = s.hora_inicio.split(':')[0];
    if (!grouped[h]) grouped[h] = [];
    grouped[h].push(s);
  });

  container.innerHTML = Object.keys(grouped).sort().map(h => {
    const sessions = grouped[h];
    return `
      <div class="timeline-group">
        ${sessions.map(s => {
          const track = getTrack(s.track_id);
          const assigned = getAssignedMembers(s.id);
          const avatarsHtml = assigned.map(m =>
            `<div class="session-card__avatar" style="background:${m.cor}; width:20px;height:20px;font-size:9px;margin-left:-4px;" title="${m.nome}">${m.inicial}</div>`
          ).join('');
          return `
            <div class="timeline-card" style="--track-color:${track.cor}" data-session-id="${s.id}">
              <div class="timeline-card__time">${s.hora_inicio}–${s.hora_fim}</div>
              <div class="timeline-card__title">${s.titulo}</div>
              <div class="timeline-card__track" style="color:${track.cor}">${track.nome}</div>
              <div class="timeline-card__avatars">${avatarsHtml}</div>
            </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

// --- Plano individual: grelha por sala + cronograma ---
const MIN_PX = 2.2; // altura em px por minuto na grelha
function toMin(h) { const [a,b] = h.split(':').map(Number); return a*60 + b; }
function fmtMin(n) { return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; }

function renderIndividual(container) {
  container.className = 'sessions-container view-individual';
  const comPlano = state.equipa.filter(m => m.trilhas && m.trilhas.length);
  const sel = getMembro(state.eu);
  const m = sel && sel.trilhas ? sel : comPlano[0];
  if (!m) {
    container.innerHTML = `<div class="no-results"><div class="no-results__text">Nenhum membro tem credencial associada.</div></div>`;
    return;
  }
  const dia = state.diaAtivo;
  const minhas = getSessoesMembro(m.id).filter(s => s.dia === dia)
    .sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio));
  // Salas do pavilhão + outras salas onde o membro tem sessões neste dia (ex.: roteiro)
  const salas = [...new Set([...m.trilhas, ...minhas.map(s => s.track_id)])];
  const tracks = salas.map(getTrack);
  const doDia = SESSOES.filter(s => s.dia === dia && salas.includes(s.track_id));
  const inscrito = s => (state.inscricoes[s.id] || []).includes(m.id);
  const primeiro = m.nome.split(' ')[0];

  const picker = comPlano.map(p => `
    <button class="ind-pick ${p.id === m.id ? 'active' : ''}" data-pick-member="${p.id}" style="--mc:${p.cor}">
      <span class="ind-pick__av" style="background:${p.cor}">${p.inicial}</span>${p.nome}
    </button>`).join('');

  const mins = minhas.filter(ativa).reduce((t,s) => t + toMin(s.hora_fim) - toMin(s.hora_inicio), 0);
  const header = `
    <div class="ind-header" style="--mc:${m.cor}">
      <div class="ind-header__av" style="background:${m.cor}">${m.inicial}</div>
      <div class="ind-header__info">
        <div class="ind-header__name">${m.nome}</div>
        <div class="ind-header__meta">${m.cargo || ''} · Credencial <strong>${m.pavilhao}</strong>${m.credencial ? ` · <a href="${encodeURI(m.credencial)}" target="_blank" rel="noopener">🎫 abrir</a>` : ''}</div>
      </div>
      <div class="ind-header__stats">
        <div><strong>${minhas.length}</strong><span>sessões</span></div>
        <div><strong>${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}</strong><span>em sala</span></div>
        <div><strong>${tracks.length}</strong><span>sala${tracks.length > 1 ? 's' : ''}</span></div>
      </div>
    </div>`;

  // Grelha: uma coluna por sala do pavilhão, blocos posicionados pela hora
  let grelha = '<p class="ind-hint">Sem sessões nas salas deste pavilhão neste dia.</p>';
  if (doDia.length) {
    const ini = Math.floor(Math.min(...doDia.map(s => toMin(s.hora_inicio))) / 30) * 30;
    const fim = Math.ceil(Math.max(...doDia.map(s => toMin(s.hora_fim))) / 30) * 30;
    const altura = (fim - ini) * MIN_PX;
    const linhas = [];
    for (let t = ini; t <= fim; t += 30) {
      linhas.push(`<div class="ind-grid__line" style="top:${(t-ini)*MIN_PX}px"><span>${fmtMin(t)}</span></div>`);
    }
    const colunas = tracks.map(tr => {
      const blocos = doDia.filter(s => s.track_id === tr.id).map(s => {
        const top = (toMin(s.hora_inicio) - ini) * MIN_PX;
        const h = Math.max((toMin(s.hora_fim) - toMin(s.hora_inicio)) * MIN_PX - 3, 18);
        const on = inscrito(s);
        return `
          <div class="ind-block ${on ? 'is-on' : ''} ${ativa(s) ? '' : 'is-cancelled'}" data-session-id="${s.id}"
               style="top:${top}px;height:${h}px;--tc:${tr.cor};--mc:${m.cor}" title="${s.hora_inicio}–${s.hora_fim} · ${s.titulo.replace(/"/g,'&quot;')}">
            <span class="ind-block__time">${s.hora_inicio}–${s.hora_fim}${on ? ' ✓' : ''}${ativa(s) ? '' : ' · CANCELADA'}</span>
            <span class="ind-block__title">${s.titulo}</span>
          </div>`;
      }).join('');
      return `
        <div class="ind-grid__col">
          <div class="ind-grid__colhead" style="border-color:${tr.cor};color:${tr.cor}">${tr.nome}</div>
          <div class="ind-grid__colbody" style="height:${altura}px">${blocos}</div>
        </div>`;
    }).join('');
    grelha = `
      <div class="ind-grid-wrap">
        <div class="ind-grid" style="--cols:${tracks.length}">
          <div class="ind-grid__axis"><div class="ind-grid__colhead">&nbsp;</div>
            <div class="ind-grid__axisbody" style="height:${altura}px">${linhas.join('')}</div></div>
          ${colunas}
        </div>
      </div>
      <p class="ind-hint">Clique numa sessão para inscrever ou remover. As sessões a cor sólida estão no plano de ${primeiro}.</p>`;
  }

  // Cronograma: sequência do dia com intervalos e mudanças de sala
  let crono = '<p class="ind-hint">Sem sessões no plano para este dia.</p>';
  if (minhas.length) {
    const itens = [];
    let prev = null;
    minhas.forEach(s => {
      const tr = getTrack(s.track_id);
      if (!ativa(s)) {
        itens.push(`
        <li class="crono__item crono__item--cancel" data-session-id="${s.id}" style="--tc:${tr.cor}">
          <span class="crono__time">${s.hora_inicio}<small>${s.hora_fim}</small></span>
          <span class="crono__body">
            <span class="crono__title">${s.titulo}</span>
            <span class="crono__meta">❌ <b>CANCELADA</b> · toque para escolher outra sessão ou use 🔁 Ajustar</span>
          </span>
        </li>`);
        return;
      }
      if (prev) {
        const gap = toMin(s.hora_inicio) - toMin(prev.hora_fim);
        const muda = prev.track_id !== s.track_id;
        if (gap < 0) itens.push(`<li class="crono__gap crono__gap--conflict">⚠️ Sobreposição de ${-gap} min com a sessão anterior</li>`);
        else if (gap === 0 && muda) itens.push(`<li class="crono__gap crono__gap--tight">⚡ Sem intervalo · mudar já para ${getTrack(s.track_id).nome}</li>`);
        else if (gap >= 15 || muda) itens.push(`<li class="crono__gap">${gap >= 60 ? '🍽️' : '☕'} ${gap} min livres${muda ? ` · mudar para ${getTrack(s.track_id).nome}` : ''}</li>`);
      }
      prev = s;
      const nomes = s.oradores.map(o => o.nome);
      itens.push(`
        <li class="crono__item" data-session-id="${s.id}" style="--tc:${tr.cor}">
          <span class="crono__time">${s.hora_inicio}<small>${s.hora_fim}</small></span>
          <span class="crono__body">
            <span class="crono__title">${badgesSessao(s)}${s.titulo}</span>
            <span class="crono__meta"><span style="color:${tr.cor}">${tr.nome}</span> · ${s.tipo}${nomes.length ? ' · ' + nomes.slice(0,2).join(', ') + (nomes.length > 2 ? '…' : '') : ''}</span>
          </span>
        </li>`);
    });
    crono = `<ol class="crono">${itens.join('')}</ol>`;
  }

  container.classList.add(`ind-show-${state.indTab}`);
  container.innerHTML = `
    <div class="ind-picker">${picker}</div>
    ${header}
    ${renderAgoraStrip(m)}
    ${(() => { const p = problemasPlano(m); return p.canceladas || p.sobreposicoes ? `
      <div class="plan-alert">
        <span>⚠️ O programa mudou: ${[p.canceladas ? `${p.canceladas} sessão(ões) cancelada(s)` : '', p.sobreposicoes ? `${p.sobreposicoes} sobreposição(ões)` : ''].filter(Boolean).join(' e ')} no plano de ${primeiro}.</span>
        <button class="btn-primary" data-ajustar>🔁 Ajustar</button>
      </div>` : ''; })()}
    <div class="ind-actions">
      <button class="btn-secondary" data-ics="${m.id}">📅 Adicionar ao calendário</button>
      <button class="btn-secondary" data-replan="${m.id}">🎫 Refazer plano de ${primeiro}</button>
    </div>
    <div class="ind-tabs" role="tablist">
      <button class="ind-tabs__btn ${state.indTab === 'crono' ? 'active' : ''}" data-ind-tab="crono">▤ Cronograma</button>
      <button class="ind-tabs__btn ${state.indTab === 'grelha' ? 'active' : ''}" data-ind-tab="grelha">▦ Grelha</button>
      <button class="ind-tabs__btn ${state.indTab === 'stands' ? 'active' : ''}" data-ind-tab="stands">🏢 Stands</button>
    </div>
    <div class="ind-layout">
      <section class="ind-section ind-section--grelha"><h3 class="ind-section__title">▦ Grelha · salas do pavilhão ${m.pavilhao}${tracks.length > m.trilhas.length ? ' + roteiro' : ''}</h3>${grelha}</section>
      <section class="ind-section ind-section--crono"><h3 class="ind-section__title">▤ Cronograma do dia</h3>${crono}</section>
    </div>
    ${renderStandsMembro(m, dia)}`;
  ligarStandsMembro(container);

  container.querySelectorAll('[data-pick-member]').forEach(b => b.addEventListener('click', () => {
    state.eu = b.dataset.pickMember;
    gravarLocal('tsm_eu', state.eu);
    renderSessions();
  }));
  container.querySelectorAll('[data-ind-tab]').forEach(b => b.addEventListener('click', () => {
    state.indTab = b.dataset.indTab;
    renderSessions();
  }));
  container.querySelector('[data-ics]').addEventListener('click', () => exportarICS(m));
  container.querySelectorAll('[data-ajustar]').forEach(b => b.addEventListener('click', executarAjuste));
  container.querySelector('[data-replan]').addEventListener('click', () => {
    if (!confirm(`Refazer o plano de ${m.nome} pela credencial? As inscrições actuais serão substituídas.`)) return;
    const n = planearPorCredencial(m);
    saveState();
    renderAll();
    showToast(`🎫 ${m.nome}: ${n} sessões planeadas`);
  });
}

// --- Navegação (desktop + telemóvel) ---
function isMobile() { return window.matchMedia('(max-width: 860px)').matches; }

function setView(v, render = true) {
  state.view = v;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.id === `view-${v}`));
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === v));
  document.body.dataset.view = v;
  if (render) renderSessions();
}

function abrirMenu() {
  document.getElementById('sidebar').classList.add('is-open');
  document.getElementById('sidebar-backdrop').classList.add('is-open');
  document.getElementById('btn-menu').setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
}
function fecharMenu() {
  document.getElementById('sidebar').classList.remove('is-open');
  document.getElementById('sidebar-backdrop').classList.remove('is-open');
  document.getElementById('btn-menu').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

// --- Agora / A seguir ---
const DIAS_EVENTO = ['2026-11-04', '2026-11-05'];
function dataLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
// Referência temporal: hora real nos dias do evento; fora deles, a hora simulada no dia seleccionado
function referenciaAgora() {
  const d = new Date();
  const hoje = dataLocalISO(d);
  if (DIAS_EVENTO.includes(hoje)) return { dia: hoje, min: d.getHours()*60 + d.getMinutes(), aoVivo: true };
  return { dia: state.diaAtivo, min: state.agoraSim, aoVivo: false };
}
function estadoMembro(m, ref) {
  const ss = getSessoesMembro(m.id).filter(s => s.dia === ref.dia && ativa(s))
    .sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio));
  const atual = ss.find(s => toMin(s.hora_inicio) <= ref.min && ref.min < toMin(s.hora_fim));
  const seguinte = ss.find(s => toMin(s.hora_inicio) > ref.min);
  return { ss, atual, seguinte };
}
function linhaSessao(s, rotulo, extra) {
  const tr = getTrack(s.track_id);
  return `
    <div class="now-row" data-session-id="${s.id}" style="--tc:${tr.cor}">
      <span class="now-row__label">${rotulo}</span>
      <span class="now-row__body">
        <span class="now-row__title">${s.titulo}</span>
        <span class="now-row__meta"><span style="color:${tr.cor}">${tr.nome}</span> · ${s.hora_inicio}–${s.hora_fim}${extra ? ' · ' + extra : ''}</span>
      </span>
    </div>`;
}
function emQuanto(min) {
  if (min < 60) return `daqui a ${min} min`;
  return `daqui a ${Math.floor(min/60)}h${String(min%60).padStart(2,'0')}`;
}

// Faixa "Agora / A seguir" no topo de Meu plano
function renderAgoraStrip(m) {
  const ref = referenciaAgora();
  if (!ref.aoVivo || ref.dia !== state.diaAtivo) return '';
  const { atual, seguinte } = estadoMembro(m, ref);
  if (!atual && !seguinte) return '';
  return `
    <div class="now-strip">
      ${atual ? linhaSessao(atual, '● Agora', `termina às ${atual.hora_fim}`) : '<div class="now-row now-row--free"><span class="now-row__label">● Agora</span><span class="now-row__body">Livre</span></div>'}
      ${seguinte ? linhaSessao(seguinte, 'A seguir', emQuanto(toMin(seguinte.hora_inicio) - ref.min)) : ''}
    </div>`;
}

// Vista "Agora": onde está cada membro e para onde vai a seguir
function renderAgora(container) {
  container.className = 'sessions-container view-agora';
  const ref = referenciaAgora();
  const membros = state.equipa.filter(m => getSessoesMembro(m.id).length);
  const diaNome = ref.dia === '2026-11-04' ? 'quarta, 4 Nov' : 'quinta, 5 Nov';

  const topo = ref.aoVivo
    ? `<div class="agora-top"><span class="agora-live">● Ao vivo</span> ${diaNome} · ${fmtMin(ref.min)}</div>`
    : `<div class="agora-top">
         <div>Fora dos dias do evento — ver onde cada um estará na <strong>${diaNome}</strong> às
           <strong id="agora-sim-label">${fmtMin(ref.min)}</strong></div>
         <input type="range" class="agora-slider" id="agora-slider" min="600" max="1140" step="5" value="${ref.min}" aria-label="Hora simulada" />
       </div>`;

  const cards = membros.map(m => {
    const { atual, seguinte } = estadoMembro(m, ref);
    return `
      <div class="agora-card" style="--mc:${m.cor}">
        <div class="agora-card__head">
          <span class="agora-card__av" style="background:${m.cor}">${m.inicial}</span>
          <span class="agora-card__name">${m.nome}</span>
          <span class="agora-card__state ${atual ? 'is-busy' : ''}">${atual ? 'Em sessão' : 'Livre'}</span>
        </div>
        ${atual ? linhaSessao(atual, 'Agora', `até ${atual.hora_fim}`) : ''}
        ${seguinte ? linhaSessao(seguinte, 'A seguir', emQuanto(toMin(seguinte.hora_inicio) - ref.min))
                   : '<div class="agora-card__done">Sem mais sessões neste dia</div>'}
      </div>`;
  }).join('');

  container.innerHTML = topo + (cards || '<div class="no-results"><div class="no-results__text">Ainda não há inscrições.</div></div>');

  const slider = document.getElementById('agora-slider');
  if (slider) {
    slider.addEventListener('input', () => {
      document.getElementById('agora-sim-label').textContent = fmtMin(Number(slider.value));
    });
    slider.addEventListener('change', () => {
      state.agoraSim = Number(slider.value);
      renderSessions();
    });
  }
}

// --- Exportar plano individual para o calendário (.ics) ---
function exportarICS(m) {
  const ss = getSessoesMembro(m.id).sort((a,b) => (a.dia + a.hora_inicio).localeCompare(b.dia + b.hora_inicio));
  if (!ss.length) { showToast('Sem sessões para exportar'); return; }
  // Madrid em Novembro = CET (UTC+1)
  const utc = (dia, h) => {
    const [Y,M,D] = dia.split('-').map(Number);
    const [hh,mm] = h.split(':').map(Number);
    return new Date(Date.UTC(Y, M-1, D, hh-1, mm)).toISOString().replace(/[-:]/g,'').slice(0,15) + 'Z';
  };
  const esc = t => String(t).replace(/\\/g,'\\\\').replace(/([,;])/g,'\\$1').replace(/\r?\n/g,'\\n');
  const dobrar = l => l.length <= 74 ? l : l.match(/.{1,73}/g).join('\r\n ');
  const agora = new Date().toISOString().replace(/[-:]/g,'').slice(0,15) + 'Z';
  const linhas = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Norporgest//Tech Show Madrid 2026//PT','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    `X-WR-CALNAME:${esc('Tech Show Madrid – ' + m.nome)}`];
  ss.forEach(s => {
    const tr = getTrack(s.track_id);
    const oradores = s.oradores.map(o => [o.nome, o.empresa].filter(Boolean).join(' – ')).join('; ');
    linhas.push('BEGIN:VEVENT', `UID:${s.id}-${m.id}@techshowmadrid2026`, `DTSTAMP:${agora}`,
      `DTSTART:${utc(s.dia, s.hora_inicio)}`, `DTEND:${utc(s.dia, s.hora_fim)}`,
      `SUMMARY:${esc(s.titulo)}`, `LOCATION:${esc(tr.nome + ' · IFEMA Madrid')}`,
      `DESCRIPTION:${esc([s.tipo, oradores, s.url].filter(Boolean).join('\n'))}`, `URL:${s.url}`,
      'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Sessão a começar','TRIGGER:-PT10M','END:VALARM',
      'END:VEVENT');
  });
  linhas.push('END:VCALENDAR');
  const blob = new Blob([linhas.map(dobrar).join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TechShowMadrid2026_${m.nome.replace(/\s+/g,'_')}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`📅 ${ss.length} sessões exportadas para o calendário`);
}

// --- Session Modal ---
function openSessionModal(sessaoId) {
  const s = SESSOES.find(x => x.id === sessaoId);
  if (!s) return;
  state.sessaoAberta = sessaoId;

  const track = getTrack(s.track_id);

  document.getElementById('modal-track-badge').textContent = track.nome;
  document.getElementById('modal-track-badge').style.color = track.cor;
  document.getElementById('modal-track-badge').style.borderColor = track.cor + '55';
  document.getElementById('modal-track-badge').style.background = track.cor + '18';

  document.getElementById('modal-time').textContent =
    `📅 ${s.dia === '2026-11-04' ? '4 Nov' : '5 Nov'} 2026 · ${s.hora_inicio} – ${s.hora_fim}`;

  document.getElementById('modal-session-title').textContent = s.titulo;
  document.getElementById('modal-desc').textContent = s.descricao;
  const hist = (s.alteracoes || []).filter(a => a.depois !== 'nova');
  document.getElementById('modal-status').innerHTML =
    (!ativa(s) ? '<div class="modal__alert">❌ Sessão <b>cancelada</b> no programa oficial.</div>' : '') +
    (hist.length ? `<div class="modal__history"><b>Alterações no programa</b>${hist.map(a => `<div>${descreverAlteracao(a)} <small>${fmtDataHora(a.em)}</small></div>`).join('')}</div>` : '');

  // Speakers
  const spkEl = document.getElementById('modal-speakers');
  if (s.oradores.length > 0) {
    spkEl.innerHTML = `
      <p class="modal__speakers-title">Oradores</p>
      ${s.oradores.map(o => `
        <div class="modal__speaker">
          <div class="modal__speaker-avatar">${o.nome.charAt(0)}</div>
          <div class="modal__speaker-info">
            <div class="modal__speaker-name">${o.nome}</div>
            <div class="modal__speaker-role">${[o.cargo, o.empresa].filter(Boolean).join(' · ')}</div>
          </div>
          ${o.role === 'moderador' ? '<span class="modal__speaker-badge">Moderador</span>' : ''}
        </div>`).join('')}`;
  } else {
    spkEl.innerHTML = '';
  }

  // Tags
  document.getElementById('modal-tags').innerHTML =
    s.tags.map(t => `<span class="modal__tag">${t}</span>`).join('');

  // URL
  document.getElementById('modal-url').innerHTML =
    `<a href="${s.url}" target="_blank" rel="noopener">🔗 Ver sessão oficial ↗</a>`;

  // Team buttons
  const assigned = state.inscricoes[sessaoId] || [];
  document.getElementById('modal-team-buttons').innerHTML = state.equipa.map(m => {
    const isAssigned = assigned.includes(m.id);
    return `
      <button class="modal__team-btn ${isAssigned ? 'assigned' : ''}" 
              data-member-id="${m.id}"
              style="color:${m.cor}; border-color:${m.cor}; background:${isAssigned ? m.cor + '22' : 'transparent'}">
        <div class="modal__team-btn-avatar" style="background:${m.cor}">${m.inicial}</div>
        ${m.nome}
        ${isAssigned ? ' ✓' : ''}
      </button>`;
  }).join('');

  document.getElementById('modal-team-buttons').querySelectorAll('[data-member-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mid = btn.dataset.memberId;
      const added = toggleInscricao(sessaoId, mid);
      const m = getMembro(mid);
      showToast(added ? `✅ ${m.nome} inscrito em "${s.titulo.substring(0,40)}..."` : `❌ ${m.nome} removido desta sessão`);
      saveState();
      openSessionModal(sessaoId); // refresh modal
      renderAll();
    });
  });

  document.getElementById('modal-session').classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeSessionModal() {
  document.getElementById('modal-session').classList.remove('is-open');
  document.body.style.overflow = '';
  state.sessaoAberta = null;
}

// --- Team Edit Modal ---
function openTeamModal() {
  const body = document.getElementById('modal-team-body');
  body.innerHTML = state.equipa.map((m,i) => `
    <div class="team-edit-item">
      <div class="team-edit-avatar" style="background:${m.cor}" id="edit-avatar-${m.id}">${m.inicial}</div>
      <input class="team-edit-input" type="text" value="${m.nome}" 
             data-member-id="${m.id}" id="edit-name-${m.id}" 
             placeholder="Nome do membro..." maxlength="30" />
      <input type="color" class="color-btn" value="${m.cor}"
             data-member-id="${m.id}" id="edit-color-${m.id}" title="Cor do membro" />
    </div>`).join('');

  // Color change preview
  body.querySelectorAll('input[type=color]').forEach(inp => {
    inp.addEventListener('input', () => {
      const mid = inp.dataset.memberId;
      document.getElementById(`edit-avatar-${mid}`).style.background = inp.value;
    });
  });

  // Initial from name
  body.querySelectorAll('.team-edit-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const mid = inp.dataset.memberId;
      const inicial = inp.value.trim().charAt(0).toUpperCase() || '?';
      document.getElementById(`edit-avatar-${mid}`).textContent = inicial;
    });
  });

  document.getElementById('modal-team').classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function saveTeam() {
  state.equipa.forEach(m => {
    const nameEl = document.getElementById(`edit-name-${m.id}`);
    const colorEl = document.getElementById(`edit-color-${m.id}`);
    if (nameEl) m.nome = nameEl.value.trim() || m.nome;
    if (colorEl) m.cor = colorEl.value;
    m.inicial = m.nome.charAt(0).toUpperCase();
  });
  document.getElementById('modal-team').classList.remove('is-open');
  document.body.style.overflow = '';
  saveState();
  renderAll();
  showToast('✅ Equipa actualizada!');
}

// --- Schedule Modal ---
function openScheduleModal() {
  const body = document.getElementById('modal-schedule-body');
  const dias = ['2026-11-04','2026-11-05'];
  const diaNomes = {'2026-11-04':'Quarta-feira, 4 Novembro', '2026-11-05':'Quinta-feira, 5 Novembro'};

  body.innerHTML = dias.map(dia => {
    const memberBlocks = state.equipa.map(m => {
      const sessoes = getSessoesMembro(m.id)
        .filter(s => s.dia === dia)
        .sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio));
      if (!sessoes.length) return '';
      const track = (s) => getTrack(s.track_id);
      return `
        <div class="schedule-member-block">
          <div class="schedule-member-header">
            <div class="schedule-member-avatar" style="background:${m.cor}">${m.inicial}</div>
            <span class="schedule-member-name">${m.nome}</span>
          </div>
          ${sessoes.map(s => `
            <div class="schedule-session-row" style="border-left-color:${track(s).cor}">
              <span class="schedule-session-time">${s.hora_inicio}–${s.hora_fim}</span>
              <span class="schedule-session-title">${s.titulo}</span>
            </div>`).join('')}
        </div>`;
    }).filter(Boolean).join('');

    if (!memberBlocks) return '';
    return `
      <div class="schedule-day">
        <div class="schedule-day__title">${diaNomes[dia]}</div>
        ${memberBlocks}
      </div>`;
  }).join('') || '<p style="color:#8892a4;text-align:center;padding:40px">Ainda não há inscrições.</p>';

  document.getElementById('modal-schedule').classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

// --- Export ---
function exportPlan() {
  const dias = {'2026-11-04':'4 Nov (Qua)','2026-11-05':'5 Nov (Qui)'};
  let txt = 'TECH SHOW MADRID 2026 – Plano de Participação da Equipa\n';
  txt += '='.repeat(60) + '\n\n';

  state.equipa.forEach(m => {
    const sessoes = getSessoesMembro(m.id).sort((a,b) => {
      if (a.dia !== b.dia) return a.dia.localeCompare(b.dia);
      return a.hora_inicio.localeCompare(b.hora_inicio);
    });
    txt += `${m.nome.toUpperCase()}\n${'─'.repeat(40)}\n`;
    if (!sessoes.length) {
      txt += '  (sem inscrições)\n\n';
    } else {
      const byDay = {};
      sessoes.forEach(s => { (byDay[s.dia] = byDay[s.dia] || []).push(s); });
      Object.keys(byDay).sort().forEach(dia => {
        txt += `  ${dias[dia]}:\n`;
        byDay[dia].forEach(s => {
          const track = getTrack(s.track_id);
          txt += `    • ${s.hora_inicio}–${s.hora_fim} | ${track.nome}\n`;
          txt += `      ${s.titulo}\n`;
        });
      });
      txt += '\n';
    }
    const stands = EXPOSITORES.filter(e => membrosExp(e).includes(m.id)).sort(ordemExp);
    if (stands.length) {
      txt += '  Stands a visitar:\n';
      stands.forEach(e => {
        const v = visita(e);
        txt += `    ${v.visitado ? '[x]' : '[ ]'} ${diaExp(e) === '2026-11-04' ? '4 Nov' : '5 Nov'} | ${e.stand} | ${e.nome} (${e.prioridade})${v.followup ? ' | FOLLOW-UP' : ''}\n`;
        if (v.contacto) txt += `        Contacto: ${v.contacto}\n`;
        if (v.notas) txt += `        Notas: ${v.notas.replace(/\n/g, ' / ')}\n`;
      });
      txt += '\n';
    }
  });

  txt += '\nGerado em: ' + new Date().toLocaleString('pt-PT');

  const blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'TechShow_Madrid_2026_Plano.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Plano exportado!');
}

// --- Toast ---
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('is-visible'), 3000);
}

// --- Render All ---
// ── STANDS (expositores a visitar · plano AI First) ──
// EXPOSITORES, CATEGORIAS_EXP e PERGUNTAS_GERAIS_EXP vêm de data/expositores.js
// (gerado por tools/expositores_site.py a partir de tools/expositores_curadoria.json).
const EXPOSITORES_FONTES = [
  'https://raw.githubusercontent.com/ugleybson/tech-show-madrid-2026/main/data/expositores.json',
  'data/expositores.json',
];
const SWAPCARD_EXPOSITORES = 'https://madridtechshow.app.swapcard.com/event/tech-show-madrid-2026/exhibitors/RXZlbnRWaWV3XzEyOTIxNTc=';
const PRIORIDADES = { A: 'Visita obrigatória', B: 'Se houver tempo', C: 'Oportunista' };
const OBJETIVOS = { parceria: '🤝 Parceria / revenda', feedback: '💬 Feedback', produto: '🧪 Produto para nós', rede: '🌍 Rede' };
let expositoresVersao = typeof EXPOSITORES_VERSAO !== 'undefined' ? EXPOSITORES_VERSAO : 0;

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function getCategoriaExp(id) { return CATEGORIAS_EXP.find(c => c.id === id) || { id, nome: id, cor: '#6366f1', perguntas: [] }; }
function getExpositor(id) { return EXPOSITORES.find(e => e.id === id); }
function visita(e) { return state.visitas[e.id] || {}; }
function membrosExp(e) { const v = visita(e); return v.membros || e.responsaveis || []; }
function diaExp(e) { return visita(e).dia || e.dia; }
function alterarVisita(e, campos) {
  const agora = new Date().toISOString();
  if ('visitado' in campos) {
    if (campos.visitado && !visita(e).visitado) Object.assign(campos, { visitado_em: agora, visitado_por: state.eu || '' });
    if (!campos.visitado) Object.assign(campos, { visitado_em: '', visitado_por: '' });
  }
  state.visitas[e.id] = { ...visita(e), ...campos, em: agora };
  saveState();
}

// Zona a partir do stand: "3E84" → Pavilhão 3 · corredor E; aldeias com prefixo próprio
function zonaStand(stand) {
  const s = String(stand || '').split(',')[0].trim().toUpperCase();
  let m;
  if ((m = s.match(/^(\d)([A-Z])\d*/))) return { nome: `Pavilhão ${m[1]} · corredor ${m[2]}`, ordem: `${m[1]}${m[2]}` };
  if (/^S\d/.test(s)) return { nome: 'Shopify Partner Village', ordem: '3ZS' };
  if (/^P\d/.test(s)) return { nome: 'PrestaShop Village', ordem: '3ZP' };
  if (/^FB/.test(s)) return { nome: 'FBA Show', ordem: '3ZF' };
  if (/^RM/.test(s)) return { nome: 'Retail Media', ordem: '3ZR' };
  return { nome: 'Outros', ordem: '9' };
}
function chaveStand(e) {
  const s = String(e.stand || '').split(',')[0].trim().toUpperCase();
  const n = (s.match(/(\d+)$/) || [0, 0])[1];
  return `${zonaStand(s).ordem}-${String(n).padStart(4, '0')}`;
}
function ordemExp(a, b) {
  return diaExp(a).localeCompare(diaExp(b)) || chaveStand(a).localeCompare(chaveStand(b));
}

// Liga cada expositor às sessões onde alguém da empresa fala (pelo campo "empresa" dos oradores)
function normEmpresa(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(s ?l ?u?|s ?a|ltd|gmbh|bv|iberia|espana|spain|group|groupe|solutions|software)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function ligarExpositoresSessoes() {
  EXPOSITORES.forEach(e => {
    const chaves = [e.nome, e.nome_oficial, ...(e.aliases || [])].map(normEmpresa).filter(k => k.length >= 3);
    const fala = s => s.oradores.some(o => {
      const emp = normEmpresa(o.empresa);
      return emp && chaves.some(k => emp === k || emp.startsWith(k + ' ') || k.startsWith(emp + ' '));
    });
    e._sessoes = SESSOES.filter(s => ativa(s) && fala(s))
      .sort((a, b) => (a.dia + a.hora_inicio).localeCompare(b.dia + b.hora_inicio)).map(s => s.id);
  });
}

function filteredExpositores() {
  let list = EXPOSITORES.slice();
  if (state.expDia === 'dia') list = list.filter(e => diaExp(e) === state.diaAtivo);
  if (state.expPrio) list = list.filter(e => e.prioridade === state.expPrio);
  if (state.expCat) list = list.filter(e => e.categoria === state.expCat);
  if (state.filtroMembro) list = list.filter(e => membrosExp(e).includes(state.filtroMembro));
  const q = state.pesquisa.trim().toLowerCase();
  if (q) list = list.filter(e => [e.nome, e.nome_oficial, e.stand, e.porque, getCategoriaExp(e.categoria).nome, visita(e).notas, visita(e).contacto]
    .some(t => String(t || '').toLowerCase().includes(q)));
  return list.sort(ordemExp);
}

function renderExpCard(e) {
  const cat = getCategoriaExp(e.categoria);
  const v = visita(e);
  const quem = membrosExp(e).map(getMembro).filter(Boolean);
  const fala = (e._sessoes || []).length;
  return `
    <div class="exp-card prio-${e.prioridade} ${v.visitado ? 'is-visited' : ''}" style="--track-color:${cat.cor}" data-exp-id="${e.id}">
      <div class="exp-card__stand">${esc(e.stand)}</div>
      <div class="exp-card__main">
        <div class="exp-card__top">
          <span class="exp-prio exp-prio--${e.prioridade}" title="${PRIORIDADES[e.prioridade]}">${e.prioridade}</span>
          <span class="exp-card__name">${esc(e.nome)}</span>
          ${v.visitado ? '<span class="exp-flag" title="Visitado">✅</span>' : ''}
          ${v.followup ? '<span class="exp-flag" title="Follow-up">🔁</span>' : ''}
        </div>
        <div class="exp-card__meta"><span style="color:${cat.cor}">${esc(cat.nome)}</span> · ${OBJETIVOS[e.objetivo] || ''}${fala ? ` · 🎤 fala ${fala}×` : ''}</div>
        <div class="exp-card__why">${esc(e.porque)}</div>
      </div>
      <div class="session-card__avatars exp-card__avatars">${quem.map(m => `<div class="session-card__avatar" style="background:${m.cor}" title="${esc(m.nome)}">${m.inicial}</div>`).join('')}</div>
    </div>`;
}

function renderExpositores(container) {
  container.className = 'sessions-container view-expositores';
  const list = filteredExpositores();
  document.getElementById('search-count').textContent = `${list.length} stands`;
  const total = EXPOSITORES.filter(e => state.expDia !== 'dia' || diaExp(e) === state.diaAtivo);
  const feitos = total.filter(e => visita(e).visitado).length;
  const chip = (attr, val, atual, txt) => `<button class="exp-chip ${atual === val ? 'active' : ''}" data-${attr}="${val}">${txt}</button>`;

  const grupos = [];
  list.forEach(e => {
    const z = (state.expDia === 'todos' ? (diaExp(e) === '2026-11-04' ? '4 Nov · ' : '5 Nov · ') : '') + zonaStand(e.stand).nome;
    if (!grupos.length || grupos[grupos.length - 1].z !== z) grupos.push({ z, itens: [] });
    grupos[grupos.length - 1].itens.push(e);
  });

  container.innerHTML = `
    <div class="exp-toolbar">
      <div class="exp-intro">
        <strong>Stands a visitar · plano AI First</strong>
        <span>${feitos}/${total.length} visitados ${state.expDia === 'dia' ? 'neste dia' : 'nos dois dias'} · ordenados pelo percurso no pavilhão</span>
      </div>
      <div class="exp-chips">
        ${chip('exp-dia', 'dia', state.expDia, '📅 Este dia')}${chip('exp-dia', 'todos', state.expDia, 'Ambos os dias')}
        <span class="exp-sep"></span>
        ${chip('exp-prio', '', state.expPrio, 'Todas')}${['A','B','C'].map(p => chip('exp-prio', p, state.expPrio, `${p} · ${PRIORIDADES[p]}`)).join('')}
      </div>
      <select class="filter-select exp-cat" id="exp-cat">
        <option value="">Todas as categorias</option>
        ${CATEGORIAS_EXP.map(c => `<option value="${c.id}" ${state.expCat === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
      </select>
    </div>
    ${grupos.length ? grupos.map(g => `
      <h3 class="exp-zone">${esc(g.z)} <span>${g.itens.length}</span></h3>
      <div class="exp-list">${g.itens.map(renderExpCard).join('')}</div>`).join('')
      : `<div class="no-results"><div class="no-results__icon">🏢</div><div class="no-results__text">Nenhum stand com estes filtros${state.expDia === 'dia' ? ' neste dia. Experimente "Ambos os dias".' : '.'}</div></div>`}
    <p class="ind-hint">Lista curada a partir de ${EXPOSITORES.length} expositores escolhidos entre os mais de 500 da lista oficial. As notas e o estado das visitas ficam guardados neste telemóvel: exporte os contactos no fim de cada dia.</p>`;

  container.querySelectorAll('[data-exp-dia]').forEach(b => b.addEventListener('click', () => { state.expDia = b.dataset.expDia; renderSessions(); }));
  container.querySelectorAll('[data-exp-prio]').forEach(b => b.addEventListener('click', () => { state.expPrio = b.dataset.expPrio; renderSessions(); }));
  container.querySelector('#exp-cat').addEventListener('change', ev => { state.expCat = ev.target.value; renderSessions(); });
  container.querySelectorAll('[data-exp-id]').forEach(el => el.addEventListener('click', () => openExpositorModal(el.dataset.expId)));
}

// Secção "Stands a visitar" no plano individual
function renderStandsMembro(m, dia) {
  const meus = EXPOSITORES.filter(e => membrosExp(e).includes(m.id) && diaExp(e) === dia).sort(ordemExp);
  const outroDia = EXPOSITORES.filter(e => membrosExp(e).includes(m.id) && diaExp(e) !== dia).length;
  const primeiro = m.nome.split(' ')[0];
  return `
    <section class="ind-section ind-section--stands ind-stands">
      <h3 class="ind-section__title ind-section__title--show">🏢 Stands a visitar · ${meus.filter(e => visita(e).visitado).length}/${meus.length} visitados</h3>
      ${meus.length ? `<ol class="stand-list">${meus.map(e => {
        const v = visita(e);
        return `
          <li class="stand-row prio-${e.prioridade} ${v.visitado ? 'is-visited' : ''}" style="--track-color:${getCategoriaExp(e.categoria).cor}">
            <button class="stand-row__check" data-visitado="${e.id}" aria-label="Marcar ${esc(e.nome)} como visitado">${v.visitado ? '✅' : '⬜'}</button>
            <span class="stand-row__body" data-exp-id="${e.id}">
              <span class="stand-row__title"><b>${esc(e.stand)}</b> · ${esc(e.nome)} <span class="exp-prio exp-prio--${e.prioridade}">${e.prioridade}</span>${v.followup ? ' 🔁' : ''}</span>
              <span class="stand-row__meta">${esc(zonaStand(e.stand).nome)} · ${OBJETIVOS[e.objetivo] || ''}</span>
            </span>
          </li>`;
      }).join('')}</ol>` : `<p class="ind-hint">Sem stands atribuídos a ${esc(primeiro)} neste dia.</p>`}
      <p class="ind-hint">${outroDia ? `${outroDia} stand(s) no outro dia. ` : ''}Aproveite os intervalos do cronograma. Toque num stand para ver perguntas, mensagem e notas.</p>
    </section>`;
}
function ligarStandsMembro(container) {
  container.querySelectorAll('[data-visitado]').forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    const e = getExpositor(b.dataset.visitado);
    alterarVisita(e, { visitado: !visita(e).visitado });
    renderAll();
  }));
  container.querySelectorAll('.stand-row__body[data-exp-id]').forEach(el => el.addEventListener('click', () => openExpositorModal(el.dataset.expId)));
}

// Mensagem para enviar pelo Swapcard (ES para empresas espanholas/internacionais, PT para portuguesas)
function mensagemContacto(e) {
  const eu = getMembro(state.eu) || getMembro(membrosExp(e)[0]) || state.equipa[0];
  const assinatura = `${eu.nome}${eu.cargo ? ` · ${eu.cargo}` : ''} · Norporgest`;
  const dias = 'el 4 y 5 de noviembre';
  if (e.idioma === 'pt') {
    const obj = {
      parceria: `Gostávamos de conhecer o vosso programa de parceiros para levar a ${e.nome} aos nossos clientes.`,
      feedback: 'Gostávamos de ouvir a vossa experiência sobre como aplicar IA em serviços para PME.',
      produto: `Queremos conhecer a ${e.nome} como ferramenta para os nossos processos e os dos nossos clientes.`,
      rede: 'Procuramos contactos para colaborar em projetos de IA para PME entre Portugal e Espanha.',
    }[e.objetivo] || '';
    return `Olá! Sou ${eu.nome.split(' ')[0]}, da Norporgest, consultora de gestão, contabilidade e incentivos para PME (Covilhã e Vila Nova de Famalicão). Estamos a tornar a empresa e os nossos serviços AI First e vamos estar no Tech Show Madrid a 4 e 5 de novembro. ${obj} Podemos falar 15 minutos no vosso stand ${e.stand}?\n\n${assinatura}`;
  }
  const obj = {
    parceria: `Nos interesa conocer vuestro programa de partners para ofrecer ${e.nome} a nuestros clientes.`,
    feedback: 'Nos gustaría conocer vuestra experiencia sobre cómo aplicar la IA en servicios para pymes.',
    produto: `Queremos conocer ${e.nome} como herramienta para nuestros procesos y los de nuestros clientes.`,
    rede: 'Buscamos contactos para colaborar en proyectos de IA para pymes entre Portugal y España.',
  }[e.objetivo] || '';
  return `¡Hola! Soy ${eu.nome.split(' ')[0]}, de Norporgest, consultora portuguesa de gestión, contabilidad e incentivos para pymes. Estamos convirtiendo la empresa y nuestros servicios en AI First y estaremos en Tech Show Madrid ${dias}. ${obj} ¿Podríamos hablar 15 minutos en vuestro stand ${e.stand}?\n\n${assinatura}`;
}

async function copiarTexto(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (err) {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) {}
    ta.remove();
    return ok;
  }
}

function perguntasExp(e, lang) {
  const cat = getCategoriaExp(e.categoria);
  const en = lang === 'en';
  const gerais = en && typeof PERGUNTAS_GERAIS_EXP_EN !== 'undefined' && PERGUNTAS_GERAIS_EXP_EN.length
    ? PERGUNTAS_GERAIS_EXP_EN : (typeof PERGUNTAS_GERAIS_EXP !== 'undefined' ? PERGUNTAS_GERAIS_EXP : []);
  return [
    ...((en && e.perguntas_en) || e.perguntas || []),
    ...((en && cat.perguntas_en) || cat.perguntas || []),
    ...gerais,
  ];
}

function openExpositorModal(id) {
  const e = getExpositor(id);
  if (!e) return;
  state.expAberto = id;
  const cat = getCategoriaExp(e.categoria);
  const v = visita(e);
  const quem = membrosExp(e);
  const perguntas = perguntasExp(e, state.pergLang);
  const feitas = v.perguntadas || [];
  const quemVisitou = getMembro(v.visitado_por);
  const sessoes = (e._sessoes || []).map(sid => SESSOES.find(s => s.id === sid)).filter(Boolean);
  const dia = diaExp(e);
  const badge = document.getElementById('modal-exp-badge');
  badge.textContent = cat.nome;
  badge.style.color = cat.cor; badge.style.borderColor = cat.cor + '55'; badge.style.background = cat.cor + '18';

  document.getElementById('modal-exp-body').innerHTML = `
    <div class="modal__time">📍 Stand <b>${esc(e.stand)}</b> · ${esc(zonaStand(e.stand).nome)} · ${dia === '2026-11-04' ? '4 Nov' : '5 Nov'}</div>
    <h2 class="modal__title" id="modal-exp-title">${esc(e.nome)}</h2>
    <div class="exp-badges">
      <span class="exp-prio exp-prio--${e.prioridade}">${e.prioridade}</span> ${PRIORIDADES[e.prioridade]}
      · ${OBJETIVOS[e.objetivo] || ''}${e.patrocinio && e.patrocinio !== 'Exhibitor' ? ` · ${esc(e.patrocinio)}` : ''}
    </div>
    <p class="modal__desc">${esc(e.porque)}</p>
    ${e.descricao_oficial ? `<p class="exp-desc-oficial">${esc(e.descricao_oficial)}</p>` : ''}
    <div class="exp-links">
      ${e.site ? `<a href="${esc(e.site)}" target="_blank" rel="noopener">🌐 Site</a>` : ''}
      ${e.ficha ? `<a href="${esc(e.ficha)}" target="_blank" rel="noopener">📄 Ficha oficial</a>` : ''}
      <a href="${SWAPCARD_EXPOSITORES}" target="_blank" rel="noopener" data-swapcard>💬 Swapcard</a>
    </div>
    <div class="exp-visita ${v.visitado ? 'is-on' : ''}">
      <p class="modal__speakers-title">🙋 A nossa visita</p>
      <div class="exp-toggles">
        <button class="exp-toggle ${v.visitado ? 'on' : ''}" data-toggle="visitado">${v.visitado ? '✅ Visitado' : '⬜ Marcar como visitado'}</button>
        <button class="exp-toggle ${v.followup ? 'on' : ''}" data-toggle="followup">${v.followup ? '🔁 Follow-up pedido' : '🔁 Pedir follow-up'}</button>
      </div>
      ${v.visitado && v.visitado_em ? `<p class="exp-visita__quando">Visitado ${fmtDataHora(v.visitado_em)}${quemVisitou ? ` por <b style="color:${quemVisitou.cor}">${esc(quemVisitou.nome)}</b>` : ''} · ${feitas.length}/${perguntas.length} perguntas feitas</p>` : ''}
    </div>
    ${sessoes.length ? `
      <p class="modal__speakers-title">🎤 Fala no programa</p>
      <ul class="exp-sessoes">${sessoes.map(s => `
        <li data-exp-sessao="${s.id}"><b>${s.dia === '2026-11-04' ? '4 Nov' : '5 Nov'} ${s.hora_inicio}</b> · ${esc(s.titulo)} <small style="color:${getTrack(s.track_id).cor}">${esc(getTrack(s.track_id).nome)}</small></li>`).join('')}
      </ul>` : ''}
    <div class="exp-perg-head">
      <p class="modal__speakers-title">❓ ${state.pergLang === 'en' ? 'Questions to ask' : 'Perguntas a fazer'}</p>
      <div class="lang-toggle" role="group" aria-label="Língua das perguntas">
        <button class="${state.pergLang === 'pt' ? 'active' : ''}" data-lang="pt">PT</button>
        <button class="${state.pergLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
      </div>
    </div>
    <ol class="exp-perguntas" ${state.pergLang === 'en' ? 'lang="en"' : ''}>${perguntas.map((p, i) => `
      <li class="${feitas.includes(i) ? 'is-done' : ''}" data-pergunta="${i}" title="Tocar para marcar como feita">${esc(p)}</li>`).join('')}</ol>
    <p class="exp-hint">Toque numa pergunta para a marcar como feita.</p>
    <label class="filter-label" for="exp-contacto">👤 Contacto no stand</label>
    <input class="exp-input" id="exp-contacto" type="text" placeholder="Nome, cargo, email ou telefone" value="${esc(v.contacto)}" />
    <label class="filter-label" for="exp-notas">📝 Observações da visita</label>
    <textarea class="exp-input" id="exp-notas" rows="5" placeholder="O que vimos e ouvimos, respostas às perguntas, preços, próximos passos...">${esc(v.notas)}</textarea>
    <p class="exp-hint">Grava automaticamente neste telemóvel. Use o 🎤 do teclado para ditar.</p>
    <div class="exp-actions">
      <button class="btn-secondary" data-copiar-msg>📋 Copiar mensagem de contacto</button>
      <button class="btn-secondary" data-mover-dia>📅 Passar para ${dia === '2026-11-04' ? '5 Nov' : '4 Nov'}</button>
    </div>`;

  document.getElementById('modal-exp-team').innerHTML = state.equipa.map(m => {
    const on = quem.includes(m.id);
    return `
      <button class="modal__team-btn ${on ? 'assigned' : ''}" data-member-id="${m.id}"
              style="color:${m.cor}; border-color:${m.cor}; background:${on ? m.cor + '22' : 'transparent'}">
        <div class="modal__team-btn-avatar" style="background:${m.cor}">${m.inicial}</div>${esc(m.nome)}${on ? ' ✓' : ''}
      </button>`;
  }).join('');

  const body = document.getElementById('modal-expositor');
  body.querySelectorAll('#modal-exp-team [data-member-id]').forEach(b => b.addEventListener('click', () => {
    const mid = b.dataset.memberId;
    const atual = membrosExp(e);
    alterarVisita(e, { membros: atual.includes(mid) ? atual.filter(x => x !== mid) : [...atual, mid] });
    openExpositorModal(id); renderAll();
  }));
  body.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.toggle;
    alterarVisita(e, { [k]: !visita(e)[k] });
    openExpositorModal(id); renderAll();
  }));
  body.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    state.pergLang = b.dataset.lang;
    gravarLocal('tsm_perg_lang', state.pergLang);
    openExpositorModal(id);
  }));
  body.querySelectorAll('[data-pergunta]').forEach(li => li.addEventListener('click', () => {
    const i = Number(li.dataset.pergunta);
    const atual = visita(e).perguntadas || [];
    alterarVisita(e, { perguntadas: atual.includes(i) ? atual.filter(x => x !== i) : [...atual, i] });
    li.classList.toggle('is-done');
  }));
  body.querySelector('[data-mover-dia]').addEventListener('click', () => {
    alterarVisita(e, { dia: dia === '2026-11-04' ? '2026-11-05' : '2026-11-04' });
    showToast(`📅 ${e.nome} passou para ${dia === '2026-11-04' ? '5' : '4'} Nov`);
    openExpositorModal(id); renderAll();
  });
  body.querySelector('[data-copiar-msg]').addEventListener('click', async () => {
    showToast(await copiarTexto(mensagemContacto(e)) ? '📋 Mensagem copiada. Cole-a no chat do Swapcard.' : '⚠️ Não foi possível copiar');
  });
  body.querySelector('[data-swapcard]').addEventListener('click', () => {
    copiarTexto(e.nome_oficial || e.nome);
    showToast(`🔎 Nome "${e.nome_oficial || e.nome}" copiado: cole-o na pesquisa do Swapcard`);
  });
  body.querySelectorAll('[data-exp-sessao]').forEach(li => li.addEventListener('click', () => {
    closeExpositorModal();
    openSessionModal(li.dataset.expSessao);
  }));
  body.querySelector('#exp-contacto').addEventListener('input', ev => { alterarVisita(e, { contacto: ev.target.value }); });
  body.querySelector('#exp-notas').addEventListener('input', ev => { alterarVisita(e, { notas: ev.target.value }); });
  body.querySelectorAll('.exp-input').forEach(i => i.addEventListener('change', () => renderAll()));

  document.getElementById('modal-expositor').classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeExpositorModal() {
  document.getElementById('modal-expositor').classList.remove('is-open');
  document.body.style.overflow = '';
  state.expAberto = null;
}

// CSV para o follow-up depois da feira (Excel PT: separador ";" e BOM)
function exportarContactosCSV() {
  const col = t => `"${String(t ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' / ')}"`;
  const linhas = [['Expositor','Stand','Dia','Prioridade','Categoria','Objetivo','Responsáveis','Visitado','Visitado em','Visitado por','Perguntas feitas','Follow-up','Contacto','Observações','Site','Actualizado']];
  EXPOSITORES.slice().sort(ordemExp).forEach(e => {
    const v = visita(e);
    linhas.push([e.nome, e.stand, diaExp(e), e.prioridade, getCategoriaExp(e.categoria).nome, (OBJETIVOS[e.objetivo] || '').replace(/^\S+\s/, ''),
      membrosExp(e).map(id => (getMembro(id) || {}).nome).filter(Boolean).join(', '),
      v.visitado ? 'sim' : 'não', v.visitado_em ? fmtDataHora(v.visitado_em) : '', (getMembro(v.visitado_por) || {}).nome || '',
      (v.perguntadas || []).length ? `${v.perguntadas.length}: ` + v.perguntadas.slice().sort((a,b) => a - b).map(i => perguntasExp(e, 'pt')[i]).filter(Boolean).join(' | ') : '',
      v.followup ? 'sim' : 'não', v.contacto, v.notas, e.site, v.em ? fmtDataHora(v.em) : '']);
  });
  const csv = '﻿' + linhas.map(l => l.map(col).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  const quem = getMembro(state.eu);
  a.href = url;
  a.download = `TechShow_Madrid_2026_Contactos${quem ? '_' + quem.nome.split(' ')[0] : ''}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📇 Contactos exportados');
}

// Lista curada actualizável sem reinstalar a app (correcções de stand, novos expositores)
async function atualizarExpositores() {
  for (const url of EXPOSITORES_FONTES) {
    try {
      const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) continue;
      const d = await r.json();
      if (!d || !Array.isArray(d.expositores) || !d.expositores.length) continue;
      if ((d.versao || 0) > expositoresVersao) {
        EXPOSITORES.splice(0, EXPOSITORES.length, ...d.expositores);
        if (Array.isArray(d.categorias)) CATEGORIAS_EXP.splice(0, CATEGORIAS_EXP.length, ...d.categorias);
        if (Array.isArray(d.perguntas_gerais) && typeof PERGUNTAS_GERAIS_EXP !== 'undefined') PERGUNTAS_GERAIS_EXP.splice(0, PERGUNTAS_GERAIS_EXP.length, ...d.perguntas_gerais);
        if (Array.isArray(d.perguntas_gerais_en) && typeof PERGUNTAS_GERAIS_EXP_EN !== 'undefined') PERGUNTAS_GERAIS_EXP_EN.splice(0, PERGUNTAS_GERAIS_EXP_EN.length, ...d.perguntas_gerais_en);
        expositoresVersao = d.versao;
        ligarExpositoresSessoes();
        renderAll();
      }
      return;
    } catch (e) { /* sem rede: fica a lista embutida */ }
  }
}

function renderAll() {
  renderEstadoPrograma();
  renderTeam();
  renderSessions();
  renderSummary();
}

// ── INIT ─────────────────────────────────────────
function init() {
  // Day tabs
  document.getElementById('day-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.day-tab');
    if (!tab) return;
    document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.diaAtivo = tab.dataset.day;
    renderSessions();
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    state.pesquisa = e.target.value;
    renderSessions();
  });

  // Filters
  document.getElementById('filter-track').addEventListener('change', e => {
    state.filtroTrack = e.target.value;
    renderAll();
  });
  document.getElementById('filter-member').addEventListener('change', e => {
    state.filtroMembro = e.target.value;
    renderAll();
  });
  document.getElementById('filter-type').addEventListener('change', e => {
    state.filtroTipo = e.target.value;
    renderSessions();
  });
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.filtroTrack = '';
    state.filtroMembro = '';
    state.filtroTipo = '';
    state.pesquisa = '';
    document.getElementById('search-input').value = '';
    document.getElementById('filter-track').value = '';
    document.getElementById('filter-member').value = '';
    document.getElementById('filter-type').value = '';
    renderAll();
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', e => {
    state.sort = e.target.value;
    renderSessions();
  });

  // View toggle
  ['grid','timeline','individual','agora','expositores'].forEach(v => {
    document.getElementById(`view-${v}`).addEventListener('click', () => setView(v));
  });

  // Telemóvel: navegação inferior e gaveta da equipa/filtros
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.nav === 'menu') { abrirMenu(); return; }
    setView(b.dataset.nav);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  document.getElementById('btn-menu').addEventListener('click', abrirMenu);
  document.getElementById('btn-menu-close').addEventListener('click', fecharMenu);
  document.getElementById('sidebar-backdrop').addEventListener('click', fecharMenu);
  // Escolher um membro na gaveta filtra o programa; no telemóvel fecha a gaveta
  document.getElementById('team-list').addEventListener('click', e => {
    if (e.target.closest('.team-member') && !e.target.closest('.team-member__cred') && isMobile()) {
      fecharMenu();
      if (state.view !== 'grid' && state.view !== 'timeline') setView('grid');
    }
  });
  ['btn-export','btn-export-contactos','btn-view-schedule','btn-plan-credencial','btn-edit-team'].forEach(id =>
    document.getElementById(id).addEventListener('click', () => { if (isMobile()) fecharMenu(); }));

  // Actualiza "Agora" a cada minuto
  setInterval(() => { if (state.view === 'agora' || state.view === 'individual') renderSessions(); }, 60000);

  // Funcionamento offline (só quando servido por http/https)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // Nova versão da app instalada: recarrega uma vez para usar logo os ficheiros novos
    if (navigator.serviceWorker.controller) {
      let recarregou = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recarregou) { recarregou = true; location.reload(); } });
    }
  }

  // Modal close buttons
  document.getElementById('modal-close').addEventListener('click', closeSessionModal);
  document.getElementById('modal-team-close').addEventListener('click', () => {
    document.getElementById('modal-team').classList.remove('is-open');
    document.body.style.overflow = '';
  });
  document.getElementById('modal-schedule-close').addEventListener('click', () => {
    document.getElementById('modal-schedule').classList.remove('is-open');
    document.body.style.overflow = '';
  });

  // Close on overlay click
  ['modal-session','modal-team','modal-schedule','modal-changes','modal-expositor'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target.id === id) {
        document.getElementById(id).classList.remove('is-open');
        document.body.style.overflow = '';
        if (id === 'modal-session') state.sessaoAberta = null;
        if (id === 'modal-expositor') state.expAberto = null;
      }
    });
  });

  // ESC to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      fecharMenu();
      ['modal-session','modal-team','modal-schedule','modal-changes','modal-expositor'].forEach(id => {
        document.getElementById(id).classList.remove('is-open');
      });
      state.expAberto = null;
      document.body.style.overflow = '';
    }
  });

  // Edit team
  document.getElementById('btn-edit-team').addEventListener('click', openTeamModal);
  document.getElementById('btn-save-team').addEventListener('click', saveTeam);

  // Export
  document.getElementById('btn-export').addEventListener('click', exportPlan);

  // Schedule
  document.getElementById('btn-view-schedule').addEventListener('click', openScheduleModal);

  // Plano pela credencial
  document.getElementById('btn-plan-credencial').addEventListener('click', planearEquipaPorCredencial);

  // Stands: contactos em CSV, modal e dados actualizáveis
  document.getElementById('btn-export-contactos').addEventListener('click', exportarContactosCSV);
  document.getElementById('modal-expositor-close').addEventListener('click', closeExpositorModal);
  ligarExpositoresSessoes();
  setTimeout(atualizarExpositores, 2500);

  // Primeira utilização: membros com credencial e sem inscrições recebem o plano automático
  let gerado = false;
  state.equipa.forEach(m => {
    if (m.trilhas && m.trilhas.length && getSessoesMembro(m.id).length === 0) gerado = planearPorCredencial(m) > 0 || gerado;
  });
  // Versão 2 do plano: roteiro de IA no plano do Pedro e sem momentos logísticos
  if (localStorage.getItem('tsm_plano_v') !== '2') {
    const m1 = getMembro('m1');
    if (m1 && m1.trilhas) gerado = planearPorCredencial(m1) > 0 || gerado;
    localStorage.setItem('tsm_plano_v', '2');
  }
  // Versão 3: credencial do Celestino (m5) — gera o plano pelas salas do E-SHOW
  if (localStorage.getItem('tsm_plano_v') !== '3') {
    const m5 = getMembro('m5');
    if (m5 && m5.trilhas) gerado = planearPorCredencial(m5) > 0 || gerado;
    localStorage.setItem('tsm_plano_v', '3');
  }
  if (gerado) saveState();

  // Programa: última versão descarregada; depois verifica a fonte (ao abrir e a cada 10 min)
  document.querySelectorAll('[data-refresh]').forEach(b => b.addEventListener('click', () => atualizarPrograma(true)));
  document.getElementById('modal-changes-close').addEventListener('click', () => fecharModal('modal-changes'));
  setTimeout(() => atualizarPrograma(false), 1500);
  setInterval(() => { if (navigator.onLine !== false) atualizarPrograma(false); }, 10 * 60000);
  window.addEventListener('online', () => atualizarPrograma(false));

  // Altura real do cabeçalho (para os separadores de dia fixos no telemóvel)
  const header = document.querySelector('.header');
  const medirHeader = () => document.documentElement.style.setProperty('--hdr', header.offsetHeight + 'px');
  medirHeader();
  window.addEventListener('resize', medirHeader);

  // Init render
  if (state.eu && getMembro(state.eu)) state.view = 'individual';
  setView(state.view, false);
  renderTrackFilter();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
