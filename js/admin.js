import { supabase } from './config/supabaseClient.js';

let currentSession = null;
let allUsers = [];
let currentFiltroProjetos = 'todos';

// ============================================================================
// 1. INICIALIZAÇÃO E GUARDA DE ACESSO
// ============================================================================
async function initAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    mostrarTelaLogin();
    return;
  }

  // Validação estrita: somente docentes entram no backoffice
  const { data: perfil, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !perfil || perfil.role !== 'professor') {
    alert('Acesso negado: seu usuário não possui credenciais de docente.');
    await supabase.auth.signOut();
    mostrarTelaLogin();
    return;
  }

  currentSession = { user: session.user, perfil };
  
  // Atualiza o crachá do professor no cabeçalho
  const profTag = document.getElementById('prof-info-header');
  if (profTag) profTag.innerText = `Docente: ${perfil.nome}`;

  document.getElementById('admin-auth-guard').style.display = 'none';
  document.getElementById('admin-app').style.display = 'flex';

  configurarNavegacao();
  configurarDrawerMobile();
  carregarDashboard();
}

function mostrarTelaLogin() {
  document.getElementById('admin-auth-guard').style.display = 'flex';
  document.getElementById('admin-app').style.display = 'none';

  const formLogin = document.getElementById('admin-login-form');
  formLogin.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-pass').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('Erro de autenticação: ' + error.message);
      return;
    }
    window.location.reload();
  };
}

// ============================================================================
// 2. NAVEGAÇÃO DE ABAS E GAVETA MOBILE (DRAWER)
// ============================================================================
function configurarNavegacao() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const viewId = `view-${btn.dataset.view}`;
      const targetView = document.getElementById(viewId);
      if (targetView) targetView.classList.add('active');

      // Fecha a gaveta mobile ao selecionar qualquer seção
      fecharDrawerMobile();

      // Carrega os dados sob demanda
      if (btn.dataset.view === 'dashboard') carregarDashboard();
      if (btn.dataset.view === 'projetos') carregarProjetos(currentFiltroProjetos);
      if (btn.dataset.view === 'vagas') carregarVagas();
      if (btn.dataset.view === 'noticias') carregarNoticias();
      if (btn.dataset.view === 'desafios') carregarDesafios();
      if (btn.dataset.view === 'usuarios') carregarUsuarios();
      if (btn.dataset.view === 'convites') carregarConvites();
    };
  });

  // Botão Sair permanente no cabeçalho
  document.getElementById('btn-admin-logout').onclick = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };
}

function configurarDrawerMobile() {
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('admin-backdrop');
  const btnToggle = document.getElementById('btn-toggle-admin-menu');
  const btnClose = document.getElementById('btn-close-admin-sidebar');

  const abrirDrawer = () => {
    sidebar?.classList.add('open');
    backdrop?.classList.add('active');
  };

  btnToggle?.addEventListener('click', abrirDrawer);
  btnClose?.addEventListener('click', fecharDrawerMobile);
  backdrop?.addEventListener('click', fecharDrawerMobile);
}

function fecharDrawerMobile() {
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('admin-backdrop');
  sidebar?.classList.remove('open');
  backdrop?.classList.remove('active');
}

// ============================================================================
// 3. DASHBOARD / MÉTRICAS
// ============================================================================
async function carregarDashboard() {
  try {
    const [
      { count: countUsers },
      { count: countProjPendentes },
      { count: countVagasPendentes },
      { count: countNoticias }
    ] = await Promise.all([
      supabase.from('perfis').select('*', { count: 'exact', head: true }),
      supabase.from('projetos').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
      supabase.from('vagas').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
      supabase.from('noticias').select('*', { count: 'exact', head: true })
    ]);

    document.getElementById('metric-usuarios').innerText = countUsers ?? 0;
    document.getElementById('metric-proj-pendentes').innerText = countProjPendentes ?? 0;
    document.getElementById('metric-vagas-pendentes').innerText = countVagasPendentes ?? 0;
    document.getElementById('metric-noticias').innerText = countNoticias ?? 0;
  } catch (err) {
    console.error('Erro ao calcular métricas:', err);
  }
}

// ============================================================================
// 4. CRUD DE PROJETOS (MODERAÇÃO, EDIÇÃO E EXCLUSÃO)
// ============================================================================
async function carregarProjetos(filtro = 'todos') {
  currentFiltroProjetos = filtro;
  let query = supabase.from('projetos').select('*').order('created_at', { ascending: false });
  if (filtro !== 'todos') query = query.eq('status', filtro);

  const { data: projetos, error } = await query;
  if (error) {
    console.error('Erro ao obter projetos:', error);
    return;
  }

  const tbody = document.getElementById('table-projetos-body');
  tbody.innerHTML = (projetos || []).map(p => `
    <tr>
      <td><strong>${p.titulo}</strong></td>
      <td>${p.autores}</td>
      <td><code>${p.tecnologias}</code></td>
      <td><span class="status-badge ${p.status}">${p.status}</span></td>
      <td>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          ${p.status === 'pendente' ? `<button class="btn-success btn-aprovar-proj" data-id="${p.id}">Aprovar</button>` : ''}
          <button class="btn-secondary btn-editar-proj" data-id="${p.id}">✏️ Editar</button>
          <button class="btn-danger btn-excluir-proj" data-id="${p.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-subtle);">Nenhum projeto encontrado.</td></tr>`;

  tbody.querySelectorAll('.btn-aprovar-proj').forEach(b => {
    b.onclick = async () => {
      await supabase.from('projetos').update({ status: 'aprovado' }).eq('id', b.dataset.id);
      carregarProjetos(currentFiltroProjetos);
      carregarDashboard();
    };
  });

  tbody.querySelectorAll('.btn-excluir-proj').forEach(b => {
    b.onclick = async () => {
      if (confirm('Tem certeza que deseja excluir permanentemente este projeto da vitrine?')) {
        await supabase.from('projetos').delete().eq('id', b.dataset.id);
        carregarProjetos(currentFiltroProjetos);
        carregarDashboard();
      }
    };
  });

  tbody.querySelectorAll('.btn-editar-proj').forEach(b => {
    b.onclick = () => {
      const p = projetos.find(item => item.id === b.dataset.id);
      if (!p) return;

      abrirModal('Editar Projeto', `
        <form id="form-edit-proj">
          <label>Título do Projeto:</label>
          <input type="text" id="ep-titulo" value="${p.titulo}" required>
          
          <label>Descrição:</label>
          <textarea id="ep-desc" rows="3" required style="width:100%; background:#090e17; color:#fff; border: 1px solid var(--border); border-radius: 6px; padding: 0.6rem;">${p.descricao}</textarea>
          
          <label>Tecnologias Utilizadas:</label>
          <input type="text" id="ep-tech" value="${p.tecnologias}" required>
          
          <label>Autores / Equipe:</label>
          <input type="text" id="ep-autores" value="${p.autores}" required>
          
          <label>Link Repositório GitHub:</label>
          <input type="url" id="ep-github" value="${p.link_github || ''}">
          
          <label>Link Deploy / Demonstração:</label>
          <input type="url" id="ep-demo" value="${p.link_projeto || ''}">
          
          <label>Situação da Moderação:</label>
          <select id="ep-status">
            <option value="aprovado" ${p.status === 'aprovado' ? 'selected' : ''}>Aprovado</option>
            <option value="pendente" ${p.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          </select>
          
          <button type="submit" class="btn-primary block">Salvar Alterações</button>
        </form>
      `);

      document.getElementById('form-edit-proj').onsubmit = async (e) => {
        e.preventDefault();
        await supabase.from('projetos').update({
          titulo: document.getElementById('ep-titulo').value.trim(),
          descricao: document.getElementById('ep-desc').value.trim(),
          tecnologias: document.getElementById('ep-tech').value.trim(),
          autores: document.getElementById('ep-autores').value.trim(),
          link_github: document.getElementById('ep-github').value.trim() || null,
          link_projeto: document.getElementById('ep-demo').value.trim() || null,
          status: document.getElementById('ep-status').value
        }).eq('id', p.id);
        
        fecharModal();
        carregarProjetos(currentFiltroProjetos);
        carregarDashboard();
      };
    };
  });

  document.querySelectorAll('.btn-filter').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.btn-filter').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      carregarProjetos(btn.dataset.filter);
    };
  });
}

// ============================================================================
// 5. CRUD DE VAGAS
// ============================================================================
async function carregarVagas() {
  const { data: vagas, error } = await supabase.from('vagas').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Erro ao obter vagas:', error);
    return;
  }

  const tbody = document.getElementById('table-vagas-body');
  tbody.innerHTML = (vagas || []).map(v => `
    <tr>
      <td><strong>${v.titulo}</strong></td>
      <td>${v.empresa}</td>
      <td>${v.tipo}</td>
      <td><span class="status-badge ${v.status}">${v.status}</span></td>
      <td>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          ${v.status === 'pendente' ? `<button class="btn-success btn-aprovar-vaga" data-id="${v.id}">Aprovar</button>` : ''}
          <button class="btn-secondary btn-editar-vaga" data-id="${v.id}">✏️ Editar</button>
          <button class="btn-danger btn-excluir-vaga" data-id="${v.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-subtle);">Nenhuma oportunidade registrada.</td></tr>`;

  tbody.querySelectorAll('.btn-aprovar-vaga').forEach(b => {
    b.onclick = async () => {
      await supabase.from('vagas').update({ status: 'aprovada' }).eq('id', b.dataset.id);
      carregarVagas();
      carregarDashboard();
    };
  });

  tbody.querySelectorAll('.btn-excluir-vaga').forEach(b => {
    b.onclick = async () => {
      if (confirm('Deseja excluir permanentemente esta oportunidade?')) {
        await supabase.from('vagas').delete().eq('id', b.dataset.id);
        carregarVagas();
        carregarDashboard();
      }
    };
  });

  tbody.querySelectorAll('.btn-editar-vaga').forEach(b => {
    b.onclick = () => {
      const v = vagas.find(item => item.id === b.dataset.id);
      if (!v) return;

      abrirModal('Editar Oportunidade', `
        <form id="form-edit-vaga">
          <label>Título da Posição:</label>
          <input type="text" id="ev-titulo" value="${v.titulo}" required>
          
          <label>Empresa:</label>
          <input type="text" id="ev-empresa" value="${v.empresa}" required>
          
          <label>Local / Regime:</label>
          <input type="text" id="ev-local" value="${v.localizacao}" required>
          
          <label>Modalidade:</label>
          <select id="ev-tipo">
            <option value="Estágio" ${v.tipo === 'Estágio' ? 'selected' : ''}>Estágio</option>
            <option value="Júnior" ${v.tipo === 'Júnior' ? 'selected' : ''}>Júnior</option>
            <option value="Freelance" ${v.tipo === 'Freelance' ? 'selected' : ''}>Freelance</option>
            <option value="Aprendiz" ${v.tipo === 'Aprendiz' ? 'selected' : ''}>Aprendiz</option>
          </select>
          
          <label>Remuneração / Bolsa:</label>
          <input type="text" id="ev-remun" value="${v.remuneracao || ''}">
          
          <label>Requisitos Técnicos:</label>
          <input type="text" id="ev-tech" value="${v.tecnologias}" required>
          
          <label>Link ou E-mail para Candidatura:</label>
          <input type="text" id="ev-link" value="${v.link_candidatura}" required>
          
          <label>Situação da Oportunidade:</label>
          <select id="ev-status">
            <option value="aprovada" ${v.status === 'aprovada' ? 'selected' : ''}>Aprovada</option>
            <option value="pendente" ${v.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          </select>
          
          <button type="submit" class="btn-primary block">Salvar Alterações</button>
        </form>
      `);

      document.getElementById('form-edit-vaga').onsubmit = async (e) => {
        e.preventDefault();
        await supabase.from('vagas').update({
          titulo: document.getElementById('ev-titulo').value.trim(),
          empresa: document.getElementById('ev-empresa').value.trim(),
          localizacao: document.getElementById('ev-local').value.trim(),
          tipo: document.getElementById('ev-tipo').value,
          remuneracao: document.getElementById('ev-remun').value.trim() || null,
          tecnologias: document.getElementById('ev-tech').value.trim(),
          link_candidatura: document.getElementById('ev-link').value.trim(),
          status: document.getElementById('ev-status').value
        }).eq('id', v.id);
        
        fecharModal();
        carregarVagas();
        carregarDashboard();
      };
    };
  });

  const btnNovaVaga = document.getElementById('btn-nova-vaga');
  if (btnNovaVaga) {
    btnNovaVaga.onclick = () => {
      abrirModal('Cadastrar Oportunidade', `
        <form id="form-modal-vaga">
          <label>Título da Oportunidade:</label><input type="text" id="mv-titulo" required placeholder="Ex: Estágio em Desenvolvimento Web">
          <label>Empresa Parceira:</label><input type="text" id="mv-empresa" required placeholder="Nome da empresa">
          <label>Localização / Formato:</label><input type="text" id="mv-local" required placeholder="Remoto ou Juiz de Fora - MG">
          <label>Modalidade:</label>
          <select id="mv-tipo">
            <option value="Estágio">Estágio</option>
            <option value="Júnior">Júnior</option>
            <option value="Freelance">Freelance</option>
            <option value="Aprendiz">Aprendiz</option>
          </select>
          <label>Remuneração / Bolsa (Opcional):</label><input type="text" id="mv-remun" placeholder="Ex: R$ 1.600 + VT">
          <label>Requisitos Técnicos:</label><input type="text" id="mv-tech" required placeholder="Ex: HTML, CSS, JavaScript">
          <label>Link ou E-mail para Envio de CV:</label><input type="text" id="mv-link" required placeholder="https://... ou vagas@empresa.com">
          <button type="submit" class="btn-primary block">Publicar Oportunidade Aprovada</button>
        </form>
      `);

      document.getElementById('form-modal-vaga').onsubmit = async (e) => {
        e.preventDefault();
        await supabase.from('vagas').insert([{
          titulo: document.getElementById('mv-titulo').value.trim(),
          empresa: document.getElementById('mv-empresa').value.trim(),
          localizacao: document.getElementById('mv-local').value.trim(),
          tipo: document.getElementById('mv-tipo').value,
          remuneracao: document.getElementById('mv-remun').value.trim() || null,
          tecnologias: document.getElementById('mv-tech').value.trim(),
          link_candidatura: document.getElementById('mv-link').value.trim(),
          status: 'aprovada'
        }]);
        fecharModal();
        carregarVagas();
        carregarDashboard();
      };
    };
  }
}

// ============================================================================
// 6. CRUD DE NOTÍCIAS
// ============================================================================
async function carregarNoticias() {
  const { data: noticias, error } = await supabase.from('noticias').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Erro ao obter notícias:', error);
    return;
  }

  const tbody = document.getElementById('table-noticias-body');
  tbody.innerHTML = (noticias || []).map(n => `
    <tr>
      <td><strong>${n.titulo}</strong></td>
      <td>${n.categoria}</td>
      <td>${n.prazo || '-'}</td>
      <td>${new Date(n.created_at).toLocaleDateString()}</td>
      <td>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          <button class="btn-secondary btn-editar-noticia" data-id="${n.id}">✏️ Editar</button>
          <button class="btn-danger btn-excluir-noticia" data-id="${n.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-subtle);">Nenhum comunicado publicado.</td></tr>`;

  tbody.querySelectorAll('.btn-excluir-noticia').forEach(b => {
    b.onclick = async () => {
      if (confirm('Deseja excluir este comunicado oficial?')) {
        await supabase.from('noticias').delete().eq('id', b.dataset.id);
        carregarNoticias();
        carregarDashboard();
      }
    };
  });

  tbody.querySelectorAll('.btn-editar-noticia').forEach(b => {
    b.onclick = () => {
      const n = noticias.find(item => item.id === b.dataset.id);
      if (!n) return;

      abrirModal('Editar Comunicado Oficial', `
        <form id="form-edit-noticia">
          <label>Título do Comunicado:</label>
          <input type="text" id="en-titulo" value="${n.titulo}" required>
          
          <label>Texto da Mensagem:</label>
          <textarea id="en-resumo" rows="4" style="width:100%; background:#090e17; color:#fff; border: 1px solid var(--border); border-radius: 6px; padding: 0.6rem;" required>${n.resumo}</textarea>
          
          <label>Categoria:</label>
          <select id="en-cat">
            <option value="Aviso" ${n.categoria === 'Aviso' ? 'selected' : ''}>Aviso</option>
            <option value="Evento" ${n.categoria === 'Evento' ? 'selected' : ''}>Evento</option>
            <option value="Prazo" ${n.categoria === 'Prazo' ? 'selected' : ''}>Prazo</option>
            <option value="Oportunidade" ${n.categoria === 'Oportunidade' ? 'selected' : ''}>Oportunidade</option>
          </select>
          
          <label>Prazo / Data Limite (Opcional):</label>
          <input type="text" id="en-prazo" value="${n.prazo || ''}">
          
          <label>Link de Ação / Edital (Opcional):</label>
          <input type="url" id="en-link" value="${n.link_acao || ''}">
          
          <button type="submit" class="btn-primary block">Salvar Alterações</button>
        </form>
      `);

      document.getElementById('form-edit-noticia').onsubmit = async (e) => {
        e.preventDefault();
        await supabase.from('noticias').update({
          titulo: document.getElementById('en-titulo').value.trim(),
          resumo: document.getElementById('en-resumo').value.trim(),
          categoria: document.getElementById('en-cat').value,
          prazo: document.getElementById('en-prazo').value.trim() || null,
          link_acao: document.getElementById('en-link').value.trim() || null
        }).eq('id', n.id);
        
        fecharModal();
        carregarNoticias();
      };
    };
  });

  const btnNovaNoticia = document.getElementById('btn-nova-noticia');
  if (btnNovaNoticia) {
    btnNovaNoticia.onclick = () => {
      abrirModal('Novo Comunicado Oficial', `
        <form id="form-modal-noticia">
          <label>Título:</label><input type="text" id="mn-titulo" required placeholder="Ex: Início das Inscrições para Feira">
          <label>Mensagem / Resumo:</label>
          <textarea id="mn-resumo" rows="4" style="width:100%; background:#090e17; color:#fff; border: 1px solid var(--border); border-radius: 6px; padding: 0.6rem;" required></textarea>
          <label>Categoria:</label>
          <select id="mn-cat">
            <option value="Aviso">Aviso</option>
            <option value="Evento">Evento</option>
            <option value="Prazo">Prazo</option>
            <option value="Oportunidade">Oportunidade</option>
          </select>
          <label>Prazo / Data Limite (Opcional):</label><input type="text" id="mn-prazo" placeholder="Ex: 30 de Outubro">
          <label>Link de Ação (Opcional):</label><input type="url" id="mn-link" placeholder="https://...">
          <button type="submit" class="btn-primary block">Publicar Comunicado</button>
        </form>
      `);

      document.getElementById('form-modal-noticia').onsubmit = async (e) => {
        e.preventDefault();
        await supabase.from('noticias').insert([{
          titulo: document.getElementById('mn-titulo').value.trim(),
          resumo: document.getElementById('mn-resumo').value.trim(),
          categoria: document.getElementById('mn-cat').value,
          prazo: document.getElementById('mn-prazo').value.trim() || null,
          link_acao: document.getElementById('mn-link').value.trim() || null
        }]);
        fecharModal();
        carregarNoticias();
        carregarDashboard();
      };
    };
  }
}

// ============================================================================
// 7. CRUD DE DESAFIOS
// ============================================================================
async function carregarDesafios() {
  const { data: desafios, error } = await supabase.from('desafios').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Erro ao obter desafios:', error);
    return;
  }

  const tbody = document.getElementById('table-desafios-body');
  tbody.innerHTML = (desafios || []).map(d => `
    <tr>
      <td><strong>${d.titulo}</strong></td>
      <td>
        <select class="select-fase" data-id="${d.id}" style="background: var(--bg-input); color: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 0.25rem;">
          <option value="inscricoes" ${d.fase === 'inscricoes' ? 'selected' : ''}>Inscrições</option>
          <option value="desenvolvimento" ${d.fase === 'desenvolvimento' ? 'selected' : ''}>Desenvolvimento</option>
          <option value="avaliacao" ${d.fase === 'avaliacao' ? 'selected' : ''}>Avaliação</option>
          <option value="encerrado" ${d.fase === 'encerrado' ? 'selected' : ''}>Encerrado</option>
        </select>
      </td>
      <td>${d.prazo_inscricao}</td>
      <td>${d.prazo_encerramento}</td>
      <td>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
          <button class="btn-secondary btn-editar-desafio" data-id="${d.id}">✏️ Editar</button>
          <button class="btn-danger btn-excluir-desafio" data-id="${d.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-subtle);">Nenhum desafio registrado.</td></tr>`;

  tbody.querySelectorAll('.select-fase').forEach(s => {
    s.onchange = async () => {
      await supabase.from('desafios').update({ fase: s.value }).eq('id', s.dataset.id);
      alert('Fase do cronograma atualizada!');
    };
  });

  tbody.querySelectorAll('.btn-excluir-desafio').forEach(b => {
    b.onclick = async () => {
      if (confirm('Deseja excluir este desafio técnico?')) {
        await supabase.from('desafios').delete().eq('id', b.dataset.id);
        carregarDesafios();
      }
    };
  });

  tbody.querySelectorAll('.btn-editar-desafio').forEach(b => {
    b.onclick = () => {
      const d = desafios.find(item => item.id === b.dataset.id);
      if (!d) return;

      abrirModal('Editar Desafio Técnico', `
        <form id="form-edit-desafio">
          <label>Nome do Desafio:</label>
          <input type="text" id="ed-titulo" value="${d.titulo}" required>
          
          <label>Regulamento / Orientações:</label>
          <textarea id="ed-desc" rows="3" style="width:100%; background:#090e17; color:#fff; border: 1px solid var(--border); border-radius: 6px; padding: 0.6rem;" required>${d.descricao}</textarea>
          
          <label>Fase:</label>
          <select id="ed-fase">
            <option value="inscricoes" ${d.fase === 'inscricoes' ? 'selected' : ''}>Inscrições</option>
            <option value="desenvolvimento" ${d.fase === 'desenvolvimento' ? 'selected' : ''}>Desenvolvimento</option>
            <option value="avaliacao" ${d.fase === 'avaliacao' ? 'selected' : ''}>Avaliação</option>
            <option value="encerrado" ${d.fase === 'encerrado' ? 'selected' : ''}>Encerrado</option>
          </select>
          
          <label>Período de Inscrição:</label>
          <input type="text" id="ed-insc" value="${d.prazo_inscricao}" required>
          
          <label>Data Final de Entrega:</label>
          <input type="text" id="ed-fim" value="${d.prazo_encerramento}" required>
          
          <label>Link do Edital Completo:</label>
          <input type="url" id="ed-link" value="${d.link_edital || ''}">
          
          <button type="submit" class="btn-primary block">Salvar Alterações</button>
        </form>
      `);

      document.getElementById('form-edit-desafio').onsubmit = async (e) => {
        e.preventDefault();
        await supabase.from('desafios').update({
          titulo: document.getElementById('ed-titulo').value.trim(),
          descricao: document.getElementById('ed-desc').value.trim(),
          fase: document.getElementById('ed-fase').value,
          prazo_inscricao: document.getElementById('ed-insc').value.trim(),
          prazo_encerramento: document.getElementById('ed-fim').value.trim(),
          link_edital: document.getElementById('ed-link').value.trim() || null
        }).eq('id', d.id);
        
        fecharModal();
        carregarDesafios();
      };
    };
  });

  const btnNovoDesafio = document.getElementById('btn-novo-desafio');
  if (btnNovoDesafio) {
    btnNovoDesafio.onclick = () => {
      abrirModal('Lançar Novo Desafio Técnico', `
        <form id="form-modal-desafio">
          <label>Nome do Desafio:</label><input type="text" id="md-titulo" required placeholder="Ex: Hackathon Web 2026">
          <label>Instruções / Tema:</label>
          <textarea id="md-desc" rows="3" style="width:100%; background:#090e17; color:#fff; border: 1px solid var(--border); border-radius: 6px; padding: 0.6rem;" required></textarea>
          <label>Período de Inscrição:</label><input type="text" id="md-insc" required placeholder="Ex: 01/10 a 10/10">
          <label>Data Final de Entrega:</label><input type="text" id="md-fim" required placeholder="Ex: 28/10">
          <label>Link do Edital Completo (Opcional):</label><input type="url" id="md-link" placeholder="https://...">
          <button type="submit" class="btn-primary block">Lançar Desafio</button>
        </form>
      `);

      document.getElementById('form-modal-desafio').onsubmit = async (e) => {
        e.preventDefault();
        await supabase.from('desafios').insert([{
          titulo: document.getElementById('md-titulo').value.trim(),
          descricao: document.getElementById('md-desc').value.trim(),
          prazo_inscricao: document.getElementById('md-insc').value.trim(),
          prazo_encerramento: document.getElementById('md-fim').value.trim(),
          link_edital: document.getElementById('md-link').value.trim() || null
        }]);
        fecharModal();
        carregarDesafios();
      };
    };
  }
}

// ============================================================================
// 8. GESTÃO DISCIPLINAR DE USUÁRIOS
// ============================================================================
async function carregarUsuarios() {
  const { data: usuarios, error } = await supabase.from('perfis').select('*').order('nome');
  if (error) {
    console.error('Erro ao listar usuários:', error);
    return;
  }

  allUsers = usuarios || [];
  renderTabelaUsuarios(allUsers);

  const searchInput = document.getElementById('search-usuario');
  if (searchInput) {
    searchInput.oninput = (e) => {
      const termo = e.target.value.toLowerCase().trim();
      const filtrados = allUsers.filter(u => 
        u.nome.toLowerCase().includes(termo) || 
        u.email.toLowerCase().includes(termo)
      );
      renderTabelaUsuarios(filtrados);
    };
  }
}

function renderTabelaUsuarios(lista) {
  const tbody = document.getElementById('table-usuarios-body');
  tbody.innerHTML = lista.map(u => {
    const isBanido = u.status === 'banido';
    return `
      <tr style="${isBanido ? 'opacity: 0.65; background: rgba(239, 68, 68, 0.05);' : ''}">
        <td><strong>${u.nome}</strong></td>
        <td>${u.email}</td>
        <td>
          <span class="status-badge ${u.role}">${u.role.toUpperCase()}</span>
          ${isBanido ? `<span class="status-badge pendente" style="background:#ef4444; color:#fff;">BANIDO</span>` : ''}
        </td>
        <td>
          <select class="change-role-select" data-id="${u.id}" style="background: var(--bg-input); color: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 0.25rem;">
            <option value="aluno" ${u.role === 'aluno' ? 'selected' : ''}>Aluno</option>
            <option value="professor" ${u.role === 'professor' ? 'selected' : ''}>Professor</option>
            <option value="empresa" ${u.role === 'empresa' ? 'selected' : ''}>Empresa</option>
          </select>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <button class="btn-secondary btn-toggle-ban" data-id="${u.id}" data-status="${u.status}">
              ${isBanido ? '✅ Reativar' : '🚫 Banir'}
            </button>
            <button class="btn-danger btn-excluir-usuario-definitivo" data-id="${u.id}" data-nome="${u.nome}">
              🗑️ Excluir Conta
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-subtle);">Nenhum usuário encontrado.</td></tr>`;

  tbody.querySelectorAll('.change-role-select').forEach(s => {
    s.onchange = async () => {
      const novoRole = s.value;
      if (confirm(`Confirmar alteração de papel para "${novoRole.toUpperCase()}"?`)) {
        const { error } = await supabase.from('perfis').update({ role: novoRole }).eq('id', s.dataset.id);
        if (error) alert('Falha ao atualizar papel: ' + error.message);
        else {
          alert('Papel acadêmico atualizado!');
          carregarUsuarios();
        }
      } else {
        carregarUsuarios();
      }
    };
  });

  tbody.querySelectorAll('.btn-toggle-ban').forEach(b => {
    b.onclick = async () => {
      const novoStatus = b.dataset.status === 'banido' ? 'ativo' : 'banido';
      const acao = novoStatus === 'banido' ? 'banir' : 'reativar';

      if (confirm(`Deseja realmente ${acao} este usuário?`)) {
        const { error } = await supabase.from('perfis').update({ status: novoStatus }).eq('id', b.dataset.id);
        if (error) alert('Erro ao alterar status: ' + error.message);
        else {
          alert(`Usuário ${novoStatus === 'banido' ? 'banido' : 'reativado'} com sucesso!`);
          carregarUsuarios();
        }
      }
    };
  });

  tbody.querySelectorAll('.btn-excluir-usuario-definitivo').forEach(b => {
    b.onclick = async () => {
      const nome = b.dataset.nome;
      if (confirm(`⚠️ ATENÇÃO: Deseja EXCLUIR DEFINITIVAMENTE a conta de "${nome}"?\n\nEsta operação removerá os dados de login e histórico permanentemente.`)) {
        const { error } = await supabase.rpc('admin_excluir_usuario', { alvo_id: b.dataset.id });
        if (error) alert('Erro ao excluir conta: ' + error.message);
        else {
          alert(`Conta de "${nome}" excluída com sucesso!`);
          carregarUsuarios();
          carregarDashboard();
        }
      }
    };
  });
}

// ============================================================================
// 9. CENTRAL DE CONVITES INSTITUCIONAIS
// ============================================================================
async function carregarConvites() {
  const { data: convites, error } = await supabase.from('convites_institucionais').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Erro ao listar convites:', error);
    return;
  }

  const tbody = document.getElementById('table-convites-body');
  tbody.innerHTML = (convites || []).map(c => {
    const linkAtivacao = `${window.location.origin}${window.location.pathname.replace('admin.html', 'index.html')}#cadastro?email=${encodeURIComponent(c.email)}`;
    return `
      <tr>
        <td><strong>${c.email}</strong></td>
        <td><span class="status-badge ${c.role}">${c.role.toUpperCase()}</span></td>
        <td>${c.usado ? '✅ Conta Criada' : '⏳ Pendente'}</td>
        <td>
          <button class="btn-secondary btn-copiar-link" data-link="${linkAtivacao}">📋 Copiar Link</button>
        </td>
        <td>
          <button class="btn-danger btn-excluir-convite" data-id="${c.id}">Revogar</button>
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-subtle);">Nenhum convite emitido.</td></tr>`;

  tbody.querySelectorAll('.btn-copiar-link').forEach(b => {
    b.onclick = async () => {
      await navigator.clipboard.writeText(b.dataset.link);
      alert('Link de convite copiado para a área de transferência!');
    };
  });

  tbody.querySelectorAll('.btn-excluir-convite').forEach(b => {
    b.onclick = async () => {
      if (confirm('Revogar este convite institucional?')) {
        await supabase.from('convites_institucionais').delete().eq('id', b.dataset.id);
        carregarConvites();
      }
    };
  });

  const formConvite = document.getElementById('form-admin-convite');
  if (formConvite) {
    formConvite.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('convite-email-input').value.trim();
      const role = document.getElementById('convite-role-input').value;

      const { error: errInsert } = await supabase.from('convites_institucionais').insert([{ email, role }]);
      if (errInsert) {
        alert('Erro ao gerar convite: ' + errInsert.message);
      } else {
        const link = `${window.location.origin}${window.location.pathname.replace('admin.html', 'index.html')}#cadastro?email=${encodeURIComponent(email)}`;
        await navigator.clipboard.writeText(link);
        alert(`✅ Convite emitido para ${email} como ${role}!\n\nO link de ativação foi copiado para sua área de transferência.`);
        document.getElementById('convite-email-input').value = '';
        carregarConvites();
      }
    };
  }
}

// ============================================================================
// 10. MODAL GENÉRICO DO BACKOFFICE
// ============================================================================
function abrirModal(titulo, htmlBody) {
  const modal = document.getElementById('admin-modal');
  document.getElementById('admin-modal-title').innerText = titulo;
  document.getElementById('admin-modal-body').innerHTML = htmlBody;
  modal?.showModal();
}

function fecharModal() {
  const modal = document.getElementById('admin-modal');
  modal?.close();
}

const btnModalClose = document.getElementById('admin-modal-close');
if (btnModalClose) btnModalClose.onclick = fecharModal;

document.addEventListener('DOMContentLoaded', initAdmin);