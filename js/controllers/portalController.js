import { supabase } from '../config/supabaseClient.js';
import { authModel } from '../models/authModel.js';
import { portalModel } from '../models/portalModel.js';
import { portalView } from '../views/portalView.js';

export const portalController = {
  currentSession: null,
  notifCounter: 0,
  todasVagas: [],

  async init() {
    // 1. CAPTURA IMEDIATA DA URL (Antes de qualquer requisição de rede limpar os parâmetros)
    const urlCompleta = window.location.href;
    const hashOriginal = window.location.hash;
    const searchOriginal = window.location.search;

    // 2. REGISTRA O OUVINTE OFICIAL DO SUPABASE PARA RECUPERAÇÃO DE SENHA
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.abrirModalRedefinirSenha();
      }
    });

    // 3. TRATA RETORNO DO E-MAIL IMEDIATAMENTE (Erros, Confirmação ou Recuperação)
    this.tratarRetornoEmail(urlCompleta, hashOriginal, searchOriginal);

    // 4. RECUPERA SESSÃO DO USUÁRIO
    this.currentSession = await authModel.getSession();

    // 5. BLOQUEIO DISCIPLINAR
    if (this.currentSession?.perfil?.status === 'banido') {
      alert('⚠️ Sua conta foi suspensa pela coordenação da instituição por descumprimento das diretrizes da comunidade.');
      await authModel.logout();
      window.location.reload();
      return;
    }

    const isProfessor = this.currentSession?.perfil?.role === 'professor';

    this.configurarNavbar(isProfessor);
    await this.carregarDados();
    this.configurarEventosUI();
    this.configurarDrawerMobile();
    this.iniciarRealtime();
  },

  // Processa links vindos do e-mail de forma resiliente
  tratarRetornoEmail(url, hash, search) {
    // A) Detecta se o link veio com erro (ex: link expirado ou já utilizado)
    if (url.includes('error_description=')) {
      const match = url.match(/error_description=([^&]+)/);
      const erro = match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : 'O link de acesso é inválido ou expirou.';
      alert('⚠️ Atenção: ' + erro + '\n\nPor favor, solicite um novo link se necessário.');
      window.history.replaceState(null, null, window.location.pathname);
      return;
    }

    // B) Detecta link de recuperação de senha pela URL
    if (hash.includes('type=recovery') || search.includes('type=recovery') || url.includes('type=recovery')) {
      this.abrirModalRedefinirSenha();
      return;
    }

    // C) Detecta link de confirmação de cadastro pela primeira vez
    if (hash.includes('type=signup') || url.includes('type=signup')) {
      alert('🎉 E-mail confirmado com sucesso! Seja bem-vindo(a) ao Conecta DS.');
      window.history.replaceState(null, null, window.location.pathname);
    }
  },

  abrirModalRedefinirSenha() {
    const modalRedefinir = document.getElementById('modal-redefinir-senha');
    if (modalRedefinir) {
      // Pequeno timeout para garantir que o DOM esteja 100% pronto
      setTimeout(() => {
        try {
          if (!modalRedefinir.open) {
            modalRedefinir.showModal();
          }
        } catch (e) {
          modalRedefinir.showModal();
        }
      }, 50);
    } else {
      console.error('Modal #modal-redefinir-senha não encontrado no index.html!');
    }
  },

  configurarNavbar(isProfessor) {
    const authActions = document.getElementById('auth-actions');
    const drawerAuth = document.getElementById('drawer-auth-actions');

    document.querySelectorAll('.tab-btn-perfil').forEach(el => {
      el.style.display = this.currentSession ? 'flex' : 'none';
    });

    document.querySelectorAll('.link-admin-panel').forEach(el => {
      el.style.display = (this.currentSession && isProfessor) ? 'flex' : 'none';
    });

    if (this.currentSession) {
      const authContent = `
        <span class="user-pill-name" title="${this.currentSession.perfil?.nome}">
          ${this.currentSession.perfil?.nome}
        </span>
        <button class="btn-logout-trigger btn-secondary" style="padding: 0.35rem 0.65rem; min-height: 36px; font-size: 0.75rem;">Sair</button>
      `;

      if (authActions) authActions.innerHTML = authContent;
      if (drawerAuth) {
        drawerAuth.innerHTML = `
          <div style="font-size:0.85rem; color:#fff; font-weight:600; margin-bottom: 0.5rem;">
            ${this.currentSession.perfil?.nome} (${this.currentSession.perfil?.role})
          </div>
          <button class="btn-logout-trigger btn-danger block" style="min-height: 40px;">🚪 Sair da Conta</button>
        `;
      }

      const greeting = document.getElementById('feed-greeting');
      if (greeting) greeting.innerText = `Olá, ${this.currentSession.perfil?.nome}! 👋`;
    } else {
      if (authActions) authActions.innerHTML = `<button id="btn-open-login" class="btn-primary" style="min-height: 36px; padding: 0.35rem 0.85rem; font-size: 0.85rem;">Entrar</button>`;
      if (drawerAuth) drawerAuth.innerHTML = `<button id="btn-open-login-drawer" class="btn-primary block">Entrar na Conta</button>`;
    }
  },

  configurarDrawerMobile() {
    const drawer = document.getElementById('nav-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const btnToggle = document.getElementById('btn-toggle-menu');
    const btnClose = document.getElementById('btn-close-drawer');

    const abrir = () => {
      drawer?.classList.add('open');
      backdrop?.classList.add('active');
    };

    const fechar = () => {
      drawer?.classList.remove('open');
      backdrop?.classList.remove('active');
    };

    btnToggle?.addEventListener('click', abrir);
    btnClose?.addEventListener('click', fechar);
    backdrop?.addEventListener('click', fechar);

    document.querySelectorAll('.drawer-links .nav-btn').forEach(btn => {
      btn.addEventListener('click', fechar);
    });
  },

  async carregarDados() {
    try {
      const [noticias, projetos, vagas, desafios] = await Promise.all([
        portalModel.getNoticias(),
        portalModel.getProjetos(),
        portalModel.getVagas(),
        portalModel.getDesafios()
      ]);

      this.todasVagas = vagas;

      portalView.renderFeed(noticias, vagas);
      portalView.renderNoticias(document.getElementById('noticias-list'), noticias);
      portalView.renderProjetos(document.getElementById('projetos-list'), projetos);
      portalView.renderVagas(document.getElementById('vagas-list'), vagas);
      portalView.renderDesafios(document.getElementById('desafios-list'), desafios);

      if (this.currentSession?.perfil) {
        const badges = await portalModel.getBadgesDoEstudante(this.currentSession.perfil.id);
        portalView.renderPerfil(this.currentSession.perfil, badges);
      }
    } catch (err) {
      console.error('Falha ao obter dados:', err);
    }
  },

  configurarEventosUI() {
    // 1. Navegação de Abas
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!btn.dataset.tab) return;
        this.navegarParaAba(btn.dataset.tab);
      });
    });

    // 2. Clique no Sino 🔔
    document.getElementById('notif-badge')?.addEventListener('click', () => {
      this.navegarParaAba('noticias');
      this.notifCounter = 0;
      document.getElementById('notif-count').innerText = 0;
    });

    // 3. Filtro Duplo de Vagas
    const aplicarFiltroVagas = () => {
      const modalidade = document.getElementById('filtro-vaga-tipo').value;
      const stack = document.getElementById('filtro-vaga-stack').value.toLowerCase().trim();

      const filtradas = this.todasVagas.filter(v => {
        const matchModalidade = modalidade === 'todos' || v.tipo === modalidade;
        const matchStack = !stack || v.tecnologias.toLowerCase().includes(stack) || v.titulo.toLowerCase().includes(stack);
        return matchModalidade && matchStack;
      });

      portalView.renderVagas(document.getElementById('vagas-list'), filtradas);
    };

    document.getElementById('filtro-vaga-tipo')?.addEventListener('change', aplicarFiltroVagas);
    document.getElementById('filtro-vaga-stack')?.addEventListener('input', aplicarFiltroVagas);

    // 4. Modais de Autenticação (Login / Cadastro)
    const modalAuth = document.getElementById('modal-auth');
    let isRegisterMode = false;

    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-open-login' || e.target.id === 'btn-open-login-drawer') {
        document.getElementById('nav-drawer')?.classList.remove('open');
        document.getElementById('drawer-backdrop')?.classList.remove('active');
        modalAuth?.showModal();
      }
      if (e.target.id === 'close-auth') modalAuth?.close();
      if (e.target.classList.contains('btn-logout-trigger') || e.target.id === 'btn-logout-perfil') {
        authModel.logout().then(() => window.location.reload());
      }
    });

    document.getElementById('link-toggle-auth')?.addEventListener('click', (e) => {
      e.preventDefault();
      isRegisterMode = !isRegisterMode;
      document.getElementById('register-fields').style.display = isRegisterMode ? 'block' : 'none';
      document.getElementById('auth-title').innerText = isRegisterMode ? 'Cadastrar Conta no Conecta DS' : 'Acessar o Conecta DS';
      document.getElementById('btn-submit-auth').innerText = isRegisterMode ? 'Cadastrar e Confirmar' : 'Entrar';
      document.getElementById('link-toggle-auth').innerText = isRegisterMode ? 'Já possui conta? Entrar' : 'Cadastre-se';

      if (!isRegisterMode) {
        document.getElementById('auth-termos').checked = false;
        document.getElementById('auth-nome').value = '';
      }
    });

    // 5. FLUXO DE RECUPERAÇÃO DE SENHA
    // A) Clique em "Esqueci minha senha" dentro do modal de login
    document.getElementById('link-esqueci-senha')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value.trim();
      
      if (!email) {
        alert('Por favor, digite seu e-mail no campo acima antes de clicar em "Esqueci minha senha".');
        document.getElementById('auth-email').focus();
        return;
      }

      try {
        await authModel.recuperarSenha(email);
        alert(`📧 Link de recuperação enviado para ${email}!\n\nVerifique sua caixa de entrada (e pasta de spam) e clique no link para redefinir sua senha.`);
        modalAuth?.close();
      } catch (err) {
        alert('Erro ao enviar recuperação: ' + err.message);
      }
    });

    // B) Fechar modal de redefinição de senha
    const modalRedefinir = document.getElementById('modal-redefinir-senha');
    document.getElementById('close-redefinir')?.addEventListener('click', () => {
      modalRedefinir?.close();
      window.history.replaceState(null, null, window.location.pathname);
    });

    // C) Salvar nova senha
    document.getElementById('form-redefinir-senha')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const novaSenha = document.getElementById('nova-senha-input').value;

      if (!novaSenha || novaSenha.length < 6) {
        alert('A senha deve ter no mínimo 6 dígitos.');
        return;
      }

      try {
        await authModel.atualizarSenha(novaSenha);
        alert('✅ Senha redefinida com sucesso! Você já está autenticado.');
        modalRedefinir?.close();
        window.history.replaceState(null, null, window.location.pathname);
        window.location.reload();
      } catch (err) {
        alert('Erro ao atualizar senha: ' + err.message);
      }
    });

    // 6. Termos LGPD
    document.getElementById('link-abrir-termos')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('modal-termos')?.showModal();
    });

    document.getElementById('close-termos')?.addEventListener('click', () => {
      document.getElementById('modal-termos')?.close();
    });

    document.getElementById('btn-aceitar-termos-fechar')?.addEventListener('click', () => {
      document.getElementById('auth-termos').checked = true;
      document.getElementById('modal-termos')?.close();
    });

    // 7. Submissão Auth (Login / Cadastro)
    document.getElementById('form-auth')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value;
      const pass = document.getElementById('auth-password').value;

      try {
        if (isRegisterMode) {
          const concordoTermos = document.getElementById('auth-termos').checked;
          if (!concordoTermos) {
            alert('Você precisa aceitar os Termos de Uso e Política de Privacidade (LGPD) para se cadastrar.');
            return;
          }

          const nome = document.getElementById('auth-nome').value.trim();
          if (!nome) {
            alert('Por favor, informe seu nome completo.');
            return;
          }

          await authModel.register(email, pass, nome);
          alert('📧 Cadastro efetuado! Um link de ativação foi enviado para o seu e-mail. Por favor, confirme antes de realizar o primeiro acesso.');
          modalAuth?.close();
        } else {
          await authModel.login(email, pass);
          window.location.reload();
        }
      } catch (err) {
        alert('Falha: ' + err.message);
      }
    });

    // 8. Modais Operacionais (Projetos e Vagas)
    const bindModal = (openId, modalId, closeId) => {
      document.addEventListener('click', (e) => {
        if (e.target.id === openId) document.getElementById(modalId)?.showModal();
        if (e.target.id === closeId) document.getElementById(modalId)?.close();
      });
    };

    bindModal('btn-open-proj-modal', 'modal-projeto', 'close-projeto');
    bindModal('btn-open-vaga-modal', 'modal-vaga', 'close-vaga');

    // 9. Edição de Perfil do Aluno
    const modalEditPerfil = document.getElementById('modal-edit-perfil');
    document.getElementById('btn-open-edit-perfil')?.addEventListener('click', () => {
      if (!this.currentSession?.perfil) return;
      const p = this.currentSession.perfil;

      document.getElementById('mep-nome').value = p.nome || '';
      document.getElementById('mep-bio').value = p.bio || '';
      document.getElementById('mep-habilidades').value = p.habilidades || '';
      document.getElementById('mep-github').value = p.github_url || '';
      document.getElementById('mep-linkedin').value = p.linkedin_url || '';

      modalEditPerfil?.showModal();
    });

    document.getElementById('close-edit-perfil')?.addEventListener('click', () => {
      modalEditPerfil?.close();
    });

    document.getElementById('form-edit-perfil')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const dadosAtualizados = {
          nome: document.getElementById('mep-nome').value.trim(),
          bio: document.getElementById('mep-bio').value.trim(),
          habilidades: document.getElementById('mep-habilidades').value.trim(),
          github_url: document.getElementById('mep-github').value.trim() || null,
          linkedin_url: document.getElementById('mep-linkedin').value.trim() || null
        };

        const perfilNovo = await portalModel.atualizarPerfil(this.currentSession.user.id, dadosAtualizados);
        this.currentSession.perfil = perfilNovo;

        const badges = await portalModel.getBadgesDoEstudante(perfilNovo.id);
        portalView.renderPerfil(perfilNovo, badges);

        alert('✅ Perfil atualizado com sucesso!');
        modalEditPerfil?.close();
      } catch (err) {
        alert('Erro ao atualizar perfil: ' + err.message);
      }
    });

    // 10. Submissão de Projeto
    document.getElementById('form-projeto')?.addEventListener('submit', async (e) => {
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
          status: 'pendente'
        });
        alert('Projeto enviado para a fila de avaliação dos professores!');
        window.location.reload();
      } catch (err) { alert(err.message); }
    });

    // 11. Submissão de Vaga
    document.getElementById('form-vaga')?.addEventListener('submit', async (e) => {
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
          status: 'pendente'
        });
        alert('Oportunidade enviada para homologação!');
        window.location.reload();
      } catch (err) { alert(err.message); }
    });
  },

  navegarParaAba(abaId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    document.querySelectorAll(`.nav-btn[data-tab="${abaId}"]`).forEach(b => b.classList.add('active'));
    const section = document.getElementById(`section-${abaId}`);
    if (section) section.classList.add('active');
  },

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