import { supabase } from './config/supabaseClient.js';

let currentSession = null;
let allUsers = [];

// ============================================================================
// 1. INICIALIZAÇÃO E PROTEÇÃO DE ACESSO
// ============================================================================
async function initAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    mostrarTelaLogin();
    return;
  }

  // Verifica se o usuário tem o papel de professor
  const { data: perfil } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!perfil || perfil.role !== 'professor') {
    alert('Acesso negado: seu usuário não possui credenciais de docente.');
    await supabase.auth.signOut();
    mostrarTelaLogin();
    return;
  }

  currentSession = { user: session.user, perfil };
  document.getElementById('prof-info').innerText = `Docente: ${perfil.nome}`;
  document.getElementById('admin-auth-guard').style.display = 'none';
  document.getElementById('admin-app').style.display = 'flex';

  configurarNavegacao();
  carregarDashboard();
}

function mostrarTelaLogin() {
  document.getElementById('admin-auth-guard').style.display = 'flex';
  document.getElementById('admin-app').style.display = 'none';

  document.getElementById('admin-login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-pass').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('Erro de acesso: ' + error.message);
      return;
    }
    window.location.reload();
  };
}

// ============================================================================
// 2. CONTROLE DE NAVEGAÇÃO
// ============================================================================
function configurarNavegacao() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const viewId = `view-${btn.dataset.view}`;
      document.getElementById(viewId).classList.add('active');

      // Executa o carregamento de acordo com a aba clicada
      if (btn.dataset.view === 'dashboard') carregarDashboard();
      if (btn.dataset.view === 'projetos') carregarProjetos('todos');
      if (btn.dataset.view === 'vagas') carregarVagas();
      if (btn.dataset.view === 'noticias') carregarNoticias();
      if (btn.dataset.view === 'desafios') carregarDesafios();
      if (btn.dataset.view === 'usuarios') carregarUsuarios();
      if (btn.dataset.view === 'convites') carregarConvites();
    };
  });

  document.getElementById('btn-admin-logout').onclick = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };
}

// ============================================================================
// 3. DASHBOARD / MÉTRICAS
// ============================================================================
async function carregarDashboard() {
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

  document.getElementById('metric-usuarios').innerText = countUsers || 0;
  document.getElementById('metric-proj-pendentes').innerText = countProjPendentes || 0;
  document.getElementById('metric-vagas-pendentes').innerText = countVagasPendentes || 0;
  document.getElementById('metric-noticias').innerText = countNoticias || 0;
}

// ============================================================================
// 4. CRUD DE PROJETOS (MODERAÇÃO & EXCLUSÃO)
// ============================================================================
async function carregarProjetos(filtro = 'todos') {
  let query = supabase.from('projetos').select('*').order('created_at', { ascending: false });
  if (filtro !== 'todos') query = query.eq('status', filtro);

  const { data: projetos } = await query;
  const tbody = document.getElementById('table-projetos-body');

  tbody.innerHTML = (projetos || []).map(p => `
    <tr>
      <td><strong>${p.titulo}</strong></td>
      <td>${p.autores}</td>
      <td><code>${p.tecnologias}</code></td>
      <td><span class="status-badge ${p.status}">${p.status}</span></td>
      <td>
        ${p.status === 'pendente' ? `<button class="btn-success btn-aprovar-proj" data-id="${p.id}">Aprovar</button>` : ''}
        <button class="btn-danger btn-excluir-proj" data-id="${p.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5">Nenhum projeto encontrado.</td></tr>`;

  // Ações
  tbody.querySelectorAll('.btn-aprovar-proj').forEach(b => {
    b.onclick = async () => {
      await supabase.from('projetos').update({ status: 'aprovado' }).eq('id', b.dataset.id);
      carregarProjetos(filtro);
    };
  });

  tbody.querySelectorAll('.btn-excluir-proj').forEach(b => {
    b.onclick = async () => {
      if (confirm('Tem certeza que deseja excluir este projeto permanentemente?')) {
        await supabase.from('projetos').delete().eq('id', b.dataset.id);
        carregarProjetos(filtro);
      }
    };
  });

  // Filtros
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
  const { data: vagas } = await supabase.from('vagas').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('table-vagas-body');

  tbody.innerHTML = (vagas || []).map(v => `
    <tr>
      <td><strong>${v.titulo}</strong></td>
      <td>${v.empresa}</td>
      <td>${v.tipo}</td>
      <td><span class="status-badge ${v.status}">${v.status}</span></td>
      <td>
        ${v.status === 'pendente' ? `<button class="btn-success btn-aprovar-vaga" data-id="${v.id}">Aprovar</button>` : ''}
        <button class="btn-danger btn-excluir-vaga" data-id="${v.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5">Nenhuma vaga cadastrada.</td></tr>`;

  tbody.querySelectorAll('.btn-aprovar-vaga').forEach(b => {
    b.onclick = async () => {
      await supabase.from('vagas').update({ status: 'aprovada' }).eq('id', b.dataset.id);
      carregarVagas();
    };
  });

  tbody.querySelectorAll('.btn-excluir-vaga').forEach(b => {
    b.onclick = async () => {
      if (confirm('Deseja excluir esta vaga?')) {
        await supabase.from('vagas').delete().eq('id', b.dataset.id);
        carregarVagas();
      }
    };
  });

  // Modal para criar nova vaga como professor
  document.getElementById('btn-nova-vaga').onclick = () => {
    abrirModal('Nova Oportunidade', `
      <form id="form-modal-vaga">
        <label>Título:</label><input type="text" id="mv-titulo" required>
        <label>Empresa:</label><input type="text" id="mv-empresa" required>
        <label>Local:</label><input type="text" id="mv-local" required>
        <label>Modalidade:</label>
        <select id="mv-tipo">
          <option value="Estágio">Estágio</option>
          <option value="Júnior">Júnior</option>
          <option value="Freelance">Freelance</option>
        </select>
        <label>Tecnologias:</label><input type="text" id="mv-tech" required>
        <label>Link/Contato:</label><input type="text" id="mv-link" required>
        <button type="submit" class="btn-primary block">Salvar e Publicar</button>
      </form>
    `);

    document.getElementById('form-modal-vaga').onsubmit = async (e) => {
      e.preventDefault();
      await supabase.from('vagas').insert([{
        titulo: document.getElementById('mv-titulo').value,
        empresa: document.getElementById('mv-empresa').value,
        localizacao: document.getElementById('mv-local').value,
        tipo: document.getElementById('mv-tipo').value,
        tecnologias: document.getElementById('mv-tech').value,
        link_candidatura: document.getElementById('mv-link').value,
        status: 'aprovada'
      }]);
      fecharModal();
      carregarVagas();
    };
  };
}

// ============================================================================
// 6. CRUD DE NOTÍCIAS
// ============================================================================
async function carregarNoticias() {
  const { data: noticias } = await supabase.from('noticias').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('table-noticias-body');

  tbody.innerHTML = (noticias || []).map(n => `
    <tr>
      <td><strong>${n.titulo}</strong></td>
      <td>${n.categoria}</td>
      <td>${n.prazo || '-'}</td>
      <td>${new Date(n.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn-danger btn-excluir-noticia" data-id="${n.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5">Nenhum comunicado publicado.</td></tr>`;

  tbody.querySelectorAll('.btn-excluir-noticia').forEach(b => {
    b.onclick = async () => {
      if (confirm('Deseja excluir este comunicado?')) {
        await supabase.from('noticias').delete().eq('id', b.dataset.id);
        carregarNoticias();
      }
    };
  });

  document.getElementById('btn-nova-noticia').onclick = () => {
    abrirModal('Novo Comunicado Oficial', `
      <form id="form-modal-noticia">
        <label>Título:</label><input type="text" id="mn-titulo" required>
        <label>Resumo:</label><textarea id="mn-resumo" rows="4" style="width:100%; background:#0b0f17; color:#fff;" required></textarea>
        <label>Categoria:</label>
        <select id="mn-cat">
          <option value="Aviso">Aviso</option>
          <option value="Evento">Evento</option>
          <option value="Prazo">Prazo</option>
        </select>
        <label>Prazo:</label><input type="text" id="mn-prazo">
        <button type="submit" class="btn-primary block">Publicar Comunicado</button>
      </form>
    `);

    document.getElementById('form-modal-noticia').onsubmit = async (e) => {
      e.preventDefault();
      await supabase.from('noticias').insert([{
        titulo: document.getElementById('mn-titulo').value,
        resumo: document.getElementById('mn-resumo').value,
        categoria: document.getElementById('mn-cat').value,
        prazo: document.getElementById('mn-prazo').value
      }]);
      fecharModal();
      carregarNoticias();
    };
  };
}

// ============================================================================
// 7. CRUD DE DESAFIOS
// ============================================================================
async function carregarDesafios() {
  const { data: desafios } = await supabase.from('desafios').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('table-desafios-body');

  tbody.innerHTML = (desafios || []).map(d => `
    <tr>
      <td><strong>${d.titulo}</strong></td>
      <td>
        <select class="select-fase" data-id="${d.id}">
          <option value="inscricoes" ${d.fase === 'inscricoes' ? 'selected' : ''}>Inscrições</option>
          <option value="desenvolvimento" ${d.fase === 'desenvolvimento' ? 'selected' : ''}>Desenvolvimento</option>
          <option value="avaliacao" ${d.fase === 'avaliacao' ? 'selected' : ''}>Avaliação</option>
          <option value="encerrado" ${d.fase === 'encerrado' ? 'selected' : ''}>Encerrado</option>
        </select>
      </td>
      <td>${d.prazo_inscricao}</td>
      <td>${d.prazo_encerramento}</td>
      <td>
        <button class="btn-danger btn-excluir-desafio" data-id="${d.id}">Excluir</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5">Nenhum desafio registrado.</td></tr>`;

  tbody.querySelectorAll('.select-fase').forEach(s => {
    s.onchange = async () => {
      await supabase.from('desafios').update({ fase: s.value }).eq('id', s.dataset.id);
      alert('Fase atualizada!');
    };
  });

  tbody.querySelectorAll('.btn-excluir-desafio').forEach(b => {
    b.onclick = async () => {
      if (confirm('Deseja excluir este desafio?')) {
        await supabase.from('desafios').delete().eq('id', b.dataset.id);
        carregarDesafios();
      }
    };
  });

  document.getElementById('btn-novo-desafio').onclick = () => {
    abrirModal('Criar Desafio Técnico', `
      <form id="form-modal-desafio">
        <label>Nome:</label><input type="text" id="md-titulo" required>
        <label>Instruções:</label><textarea id="md-desc" rows="3" style="width:100%; background:#0b0f17; color:#fff;" required></textarea>
        <label>Período de Inscrição:</label><input type="text" id="md-insc" required placeholder="Ex: 01/10 a 10/10">
        <label>Entrega Final:</label><input type="text" id="md-fim" required placeholder="Ex: 30/10">
        <button type="submit" class="btn-primary block">Lançar Desafio</button>
      </form>
    `);

    document.getElementById('form-modal-desafio').onsubmit = async (e) => {
      e.preventDefault();
      await supabase.from('desafios').insert([{
        titulo: document.getElementById('md-titulo').value,
        descricao: document.getElementById('md-desc').value,
        prazo_inscricao: document.getElementById('md-insc').value,
        prazo_encerramento: document.getElementById('md-fim').value
      }]);
      fecharModal();
      carregarDesafios();
    };
  };
}

// ============================================================================
// 8. GESTÃO DE USUÁRIOS E PAPÉIS
// ============================================================================
async function carregarUsuarios() {
  const { data: usuarios } = await supabase.from('perfis').select('*').order('nome');
  allUsers = usuarios || [];
  renderTabelaUsuarios(allUsers);

  document.getElementById('search-usuario').oninput = (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = allUsers.filter(u => u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo));
    renderTabelaUsuarios(filtrados);
  };
}

function renderTabelaUsuarios(lista) {
  const tbody = document.getElementById('table-usuarios-body');
  tbody.innerHTML = lista.map(u => `
    <tr>
      <td><strong>${u.nome}</strong></td>
      <td>${u.email}</td>
      <td><span class="status-badge ${u.role}">${u.role.toUpperCase()}</span></td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td>
        <select class="change-role-select" data-id="${u.id}">
          <option value="aluno" ${u.role === 'aluno' ? 'selected' : ''}>Aluno</option>
          <option value="professor" ${u.role === 'professor' ? 'selected' : ''}>Professor</option>
          <option value="empresa" ${u.role === 'empresa' ? 'selected' : ''}>Empresa</option>
        </select>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5">Nenhum usuário encontrado.</td></tr>`;

  tbody.querySelectorAll('.change-role-select').forEach(s => {
    s.onchange = async () => {
      if (confirm(`Alterar papel deste usuário para "${s.value.toUpperCase()}"?`)) {
        const { error } = await supabase.from('perfis').update({ role: s.value }).eq('id', s.dataset.id);
        if (error) alert('Falha: ' + error.message);
        else {
          alert('Papel atualizado com sucesso!');
          carregarUsuarios();
        }
      } else {
        carregarUsuarios();
      }
    };
  });
}

// ============================================================================
// 9. CENTRAL DE CONVITES
// ============================================================================
async function carregarConvites() {
  const { data: convites } = await supabase.from('convites_institucionais').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('table-convites-body');

  tbody.innerHTML = (convites || []).map(c => {
    const linkAtivacao = `${window.location.origin}${window.location.pathname.replace('admin.html', 'index.html')}#cadastro?email=${encodeURIComponent(c.email)}`;
    return `
      <tr>
        <td><strong>${c.email}</strong></td>
        <td><span class="status-badge ${c.role}">${c.role.toUpperCase()}</span></td>
        <td>${c.usado ? '✅ Conta Criada' : '⏳ Pendente'}</td>
        <td>
          <button class="btn-secondary btn-copiar-link" data-link="${linkAtivacao}">Copiar Link</button>
        </td>
        <td>
          <button class="btn-danger btn-excluir-convite" data-id="${c.id}">Revogar</button>
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="5">Nenhum convite emitido.</td></tr>`;

  tbody.querySelectorAll('.btn-copiar-link').forEach(b => {
    b.onclick = async () => {
      await navigator.clipboard.writeText(b.dataset.link);
      alert('Link copiado para a área de transferência!');
    };
  });

  tbody.querySelectorAll('.btn-excluir-convite').forEach(b => {
    b.onclick = async () => {
      if (confirm('Revogar este convite?')) {
        await supabase.from('convites_institucionais').delete().eq('id', b.dataset.id);
        carregarConvites();
      }
    };
  });

  document.getElementById('form-admin-convite').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('convite-email-input').value.trim();
    const role = document.getElementById('convite-role-input').value;

    const { error } = await supabase.from('convites_institucionais').insert([{ email, role }]);
    if (error) alert('Erro: ' + error.message);
    else {
      alert(`Convite gerado para ${email}!`);
      document.getElementById('convite-email-input').value = '';
      carregarConvites();
    }
  };
}

// ============================================================================
// AUXILIARES DE MODAL
// ============================================================================
function abrirModal(titulo, htmlBody) {
  const modal = document.getElementById('admin-modal');
  document.getElementById('admin-modal-title').innerText = titulo;
  document.getElementById('admin-modal-body').innerHTML = htmlBody;
  modal.showModal();
}

function fecharModal() {
  document.getElementById('admin-modal').close();
}

document.getElementById('admin-modal-close').onclick = fecharModal;
document.addEventListener('DOMContentLoaded', initAdmin);