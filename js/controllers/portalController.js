import { supabase } from '../config/supabaseClient.js';
import { authModel } from '../models/authModel.js';
import { portalModel } from '../models/portalModel.js';
import { portalView } from '../views/portalView.js';

export const portalController = {
  currentSession: null,
  notifCounter: 0,

  async init() {
    this.currentSession = await authModel.getSession();
    const isProfessor = this.currentSession?.perfil?.role === 'professor';

    this.configurarNavbar();
    await this.carregarDados(isProfessor);
    this.configurarEventosUI(isProfessor);
    this.iniciarRealtime();
  },

  configurarNavbar() {
    const authActions = document.getElementById('auth-actions');
    const tabPerfil = document.getElementById('tab-btn-perfil');

    if (this.currentSession) {
      tabPerfil.style.display = 'inline-block';
      authActions.innerHTML = `
        <span style="font-size:0.85rem; color:#fff; font-weight:600;">${this.currentSession.perfil?.nome}</span>
        <button id="btn-logout" class="btn-secondary" style="padding:4px 8px; font-size:0.8rem;">Sair</button>
      `;
      document.getElementById('feed-greeting').innerText = `Olá, ${this.currentSession.perfil?.nome}! 👋`;
    } else {
      tabPerfil.style.display = 'none';
      authActions.innerHTML = `<button id="btn-open-login" class="btn-primary">Entrar</button>`;
    }
  },

  async carregarDados(isProfessor) {
    try {
      const [noticias, projetos, vagas, desafios] = await Promise.all([
        portalModel.getNoticias(),
        portalModel.getProjetos(),
        portalModel.getVagas(),
        portalModel.getDesafios()
      ]);

      portalView.renderFeed(noticias, vagas);
      portalView.renderNoticias(document.getElementById('noticias-list'), noticias);
      portalView.renderProjetos(document.getElementById('projetos-list'), projetos, isProfessor);
      portalView.renderVagas(document.getElementById('vagas-list'), vagas, isProfessor);
      portalView.renderDesafios(document.getElementById('desafios-list'), desafios);

      if (isProfessor) {
        document.getElementById('admin-news-btn-area').innerHTML = `<button id="btn-open-noticia-modal" class="btn-primary">+ Novo Comunicado</button>`;
        document.getElementById('admin-desafio-btn-area').innerHTML = `<button id="btn-open-desafio-modal" class="btn-primary">+ Novo Desafio</button>`;
      }

      if (this.currentSession?.perfil) {
        const badges = await portalModel.getBadgesDoEstudante(this.currentSession.perfil.id);
        portalView.renderPerfil(this.currentSession.perfil, badges);
      }
    } catch (err) {
      console.error('Falha ao carregar dados do portal:', err);
    }
  },

  configurarEventosUI(isProfessor) {
    // 1. Alternância de Abas
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`section-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // 2. Filtro de Vagas
    document.getElementById('filtro-vaga-tipo').addEventListener('change', async (e) => {
      const filtro = e.target.value;
      const todas = await portalModel.getVagas();
      const filtradas = filtro === 'todos' ? todas : todas.filter(v => v.tipo === filtro);
      portalView.renderVagas(document.getElementById('vagas-list'), filtradas, isProfessor);
    });

    // 3. Controle dos Modais
    const modalAuth = document.getElementById('modal-auth');
    let isRegisterMode = false;

    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-open-login') modalAuth.showModal();
      if (e.target.id === 'close-auth') modalAuth.close();
      if (e.target.id === 'btn-logout') authModel.logout().then(() => window.location.reload());
    });

    document.getElementById('link-toggle-auth').addEventListener('click', (e) => {
      e.preventDefault();
      isRegisterMode = !isRegisterMode;
      document.getElementById('register-fields').style.display = isRegisterMode ? 'block' : 'none';
      document.getElementById('auth-title').innerText = isRegisterMode ? 'Criar Conta no Conecta DS' : 'Acessar o Conecta DS';
      document.getElementById('btn-submit-auth').innerText = isRegisterMode ? 'Cadastrar e Validar E-mail' : 'Entrar';
      document.getElementById('link-toggle-auth').innerText = isRegisterMode ? 'Já possui conta? Entrar' : 'Cadastre-se';
    });

    // 4. Submissão de Autenticação (Login / Cadastro)
    document.getElementById('form-auth').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value;
      const pass = document.getElementById('auth-password').value;

      try {
        if (isRegisterMode) {
          const nome = document.getElementById('auth-nome').value;
          await authModel.register(email, pass, nome);
          alert('📧 Cadastro realizado! Enviamos um link de confirmação para o seu e-mail. Ative sua conta antes de efetuar login.');
          modalAuth.close();
        } else {
          await authModel.login(email, pass);
          window.location.reload();
        }
      } catch (err) {
        alert('Erro de autenticação: ' + err.message);
      }
    });

    // 5. Modais Operacionais
    const bindModal = (openBtnId, modalId, closeBtnId) => {
      document.addEventListener('click', (e) => {
        if (e.target.id === openBtnId) document.getElementById(modalId).showModal();
        if (e.target.id === closeBtnId) document.getElementById(modalId).close();
      });
    };

    bindModal('btn-open-proj-modal', 'modal-projeto', 'close-projeto');
    bindModal('btn-open-vaga-modal', 'modal-vaga', 'close-vaga');
    bindModal('btn-open-noticia-modal', 'modal-noticia', 'close-noticia');
    bindModal('btn-open-desafio-modal', 'modal-desafio', 'close-desafio');

    // 6. Formulários
    document.getElementById('form-projeto').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.currentSession) {
        alert('Você precisa estar autenticado para submeter um projeto!');
        document.getElementById('modal-auth').showModal();
        return;
      }

      try {
        await portalModel.criarProjeto({
          titulo: document.getElementById('proj-titulo').value,
          descricao: document.getElementById('proj-descricao').value,
          tecnologias: document.getElementById('proj-tecnologias').value,
          autores: document.getElementById('proj-autores').value,
          link_github: document.getElementById('proj-github').value,
          link_projeto: document.getElementById('proj-demo').value,
          status: isProfessor ? 'aprovado' : 'pendente'
        });
        alert('Projeto enviado com sucesso!');
        window.location.reload();
      } catch (err) { alert('Erro: ' + err.message); }
    });

    document.getElementById('form-vaga').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.currentSession) {
        alert('Você precisa estar autenticado para sugerir uma vaga!');
        document.getElementById('modal-auth').showModal();
        return;
      }

      try {
        await portalModel.criarVaga({
          titulo: document.getElementById('vaga-titulo').value,
          empresa: document.getElementById('vaga-empresa').value,
          localizacao: document.getElementById('vaga-localizacao').value,
          tipo: document.getElementById('vaga-tipo').value,
          remuneracao: document.getElementById('vaga-remuneracao').value,
          tecnologias: document.getElementById('vaga-tecnologias').value,
          link_candidatura: document.getElementById('vaga-link').value,
          status: isProfessor ? 'aprovada' : 'pendente'
        });
        alert('Oportunidade registrada para moderação!');
        window.location.reload();
      } catch (err) { alert('Erro: ' + err.message); }
    });

    if (isProfessor) {
      document.getElementById('form-noticia').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await portalModel.criarNoticia({
            titulo: document.getElementById('noticia-titulo').value,
            resumo: document.getElementById('noticia-resumo').value,
            categoria: document.getElementById('noticia-categoria').value,
            prazo: document.getElementById('noticia-prazo').value,
            link_acao: document.getElementById('noticia-link').value
          });
          alert('Comunicado oficial publicado!');
          window.location.reload();
        } catch (err) { alert('Erro: ' + err.message); }
      });

      document.getElementById('form-desafio').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await portalModel.criarDesafio({
            titulo: document.getElementById('desafio-titulo').value,
            descricao: document.getElementById('desafio-descricao').value,
            fase: document.getElementById('desafio-fase').value,
            prazo_inscricao: document.getElementById('desafio-data-insc').value,
            prazo_encerramento: document.getElementById('desafio-data-fim').value,
            link_edital: document.getElementById('desafio-link').value
          });
          alert('Desafio criado com sucesso!');
          window.location.reload();
        } catch (err) { alert('Erro: ' + err.message); }
      });
    }

    // 7. Moderação (Aprovações do Professor)
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-aprovar-projeto')) {
        await portalModel.aprovarProjeto(e.target.dataset.id);
        alert('Projeto aprovado! Badge concedida ao autor caso seja o primeiro.');
        window.location.reload();
      }
      if (e.target.classList.contains('btn-aprovar-vaga')) {
        await portalModel.aprovarVaga(e.target.dataset.id);
        alert('Vaga homologada no mural de oportunidades!');
        window.location.reload();
      }
    });
  },

  // 8. Notificações Realtime via Supabase WebSockets
  iniciarRealtime() {
    supabase
      .channel('noticias-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'noticias' }, payload => {
        this.notifCounter++;
        document.getElementById('notif-count').innerText = this.notifCounter;
        alert(`🔔 Novo Comunicado Institucional: ${payload.new.titulo}`);
      })
      .subscribe();
  }
};