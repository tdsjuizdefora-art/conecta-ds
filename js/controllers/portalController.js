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

    this.configurarNavbar(isProfessor);
    await this.carregarDados(isProfessor);
    this.configurarEventosUI(isProfessor);
    this.iniciarRealtime();
  },

  configurarNavbar(isProfessor) {
    const authActions = document.getElementById('auth-actions');
    const tabPerfil = document.getElementById('tab-btn-perfil');
    const tabAdmin = document.getElementById('tab-btn-admin');

    if (this.currentSession) {
      tabPerfil.style.display = 'inline-block';
      if (isProfessor) tabAdmin.style.display = 'inline-block';

      authActions.innerHTML = `
        <span style="font-size:0.85rem; color:#fff; font-weight:600;">
          ${this.currentSession.perfil?.nome} (${this.currentSession.perfil?.role})
        </span>
        <button id="btn-logout" class="btn-secondary" style="padding:4px 8px; font-size:0.8rem;">Sair</button>
      `;
      document.getElementById('feed-greeting').innerText = `Olá, ${this.currentSession.perfil?.nome}! 👋`;
    } else {
      tabPerfil.style.display = 'none';
      tabAdmin.style.display = 'none';
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
        
        const convites = await portalModel.getConvites();
        portalView.renderConvites(document.getElementById('convites-list'), convites);
      }

      if (this.currentSession?.perfil) {
        const badges = await portalModel.getBadgesDoEstudante(this.currentSession.perfil.id);
        portalView.renderPerfil(this.currentSession.perfil, badges);
      }
    } catch (err) {
      console.error('Falha ao obter dados:', err);
    }
  },

  configurarEventosUI(isProfessor) {
    // Abas
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`section-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Filtro de Vagas
    document.getElementById('filtro-vaga-tipo').addEventListener('change', async (e) => {
      const filtro = e.target.value;
      const todas = await portalModel.getVagas();
      const filtradas = filtro === 'todos' ? todas : todas.filter(v => v.tipo === filtro);
      portalView.renderVagas(document.getElementById('vagas-list'), filtradas, isProfessor);
    });

    // Modais de Autenticação
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
      document.getElementById('auth-title').innerText = isRegisterMode ? 'Cadastrar Conta no Conecta DS' : 'Acessar o Conecta DS';
      document.getElementById('btn-submit-auth').innerText = isRegisterMode ? 'Cadastrar e Confirmar' : 'Entrar';
      document.getElementById('link-toggle-auth').innerText = isRegisterMode ? 'Já possui conta? Entrar' : 'Cadastre-se';
    });

    document.getElementById('form-auth').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value;
      const pass = document.getElementById('auth-password').value;

      try {
        if (isRegisterMode) {
          const nome = document.getElementById('auth-nome').value;
          await authModel.register(email, pass, nome);
          alert('📧 Cadastro efetuado! Verifique sua caixa de entrada para confirmar o e-mail antes do primeiro acesso.');
          modalAuth.close();
        } else {
          await authModel.login(email, pass);
          window.location.reload();
        }
      } catch (err) {
        alert('Falha: ' + err.message);
      }
    });

    // Modais Operacionais
    const bindModal = (openId, modalId, closeId) => {
      document.addEventListener('click', (e) => {
        if (e.target.id === openId) document.getElementById(modalId).showModal();
        if (e.target.id === closeId) document.getElementById(modalId).close();
      });
    };

    bindModal('btn-open-proj-modal', 'modal-projeto', 'close-projeto');
    bindModal('btn-open-vaga-modal', 'modal-vaga', 'close-vaga');
    bindModal('btn-open-noticia-modal', 'modal-noticia', 'close-noticia');
    bindModal('btn-open-desafio-modal', 'modal-desafio', 'close-desafio');

    // Submissão de Projeto
    document.getElementById('form-projeto').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.currentSession) return alert('Faça login para submeter projetos!');

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
        alert('Projeto enviado!');
        window.location.reload();
      } catch (err) { alert(err.message); }
    });

    // Submissão de Vaga
    document.getElementById('form-vaga').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.currentSession) return alert('Faça login para submeter vagas!');

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
        alert('Vaga enviada para análise!');
        window.location.reload();
      } catch (err) { alert(err.message); }
    });

    // Ações de Professor
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
          alert('Notícia publicada!');
          window.location.reload();
        } catch (err) { alert(err.message); }
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
          alert('Desafio criado!');
          window.location.reload();
        } catch (err) { alert(err.message); }
      });

      // Gerador de Convite com link copiado
      document.getElementById('form-convite').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('convite-email').value.trim();
        const role = document.getElementById('convite-role').value;

        try {
          await portalModel.criarConvite(email, role);
          const link = `${window.location.origin}${window.location.pathname}#cadastro?email=${encodeURIComponent(email)}`;
          await navigator.clipboard.writeText(link);
          alert(`✅ Convite emitido para ${email} como ${role}!\n\nLink copiado para a área de transferência:\n${link}`);
          window.location.reload();
        } catch (err) { alert('Erro: ' + err.message); }
      });
    }

    // Moderação
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-aprovar-projeto')) {
        await portalModel.aprovarProjeto(e.target.dataset.id);
        alert('Projeto aprovado! Badge concedida se for o 1º projeto.');
        window.location.reload();
      }
      if (e.target.classList.contains('btn-aprovar-vaga')) {
        await portalModel.aprovarVaga(e.target.dataset.id);
        alert('Vaga aprovada no mural!');
        window.location.reload();
      }
    });
  },

  iniciarRealtime() {
    supabase
      .channel('noticias-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'noticias' }, payload => {
        this.notifCounter++;
        document.getElementById('notif-count').innerText = this.notifCounter;
        alert(`🔔 Novo Comunicado: ${payload.new.titulo}`);
      })
      .subscribe();
  }
};