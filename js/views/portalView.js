export const portalView = {
  renderFeed(noticias, vagas) {
    const feedNoticias = document.getElementById('feed-noticias');
    const feedVagas = document.getElementById('feed-vagas');

    feedNoticias.innerHTML = noticias.slice(0, 3).map(n => `
      <div class="card">
        <span class="card-tag">${n.categoria}</span>
        <strong style="color:#fff;">${n.titulo}</strong>
        <p style="font-size:0.85rem;">${n.resumo}</p>
      </div>
    `).join('') || '<p>Sem avisos no momento.</p>';

    feedVagas.innerHTML = vagas.slice(0, 3).map(v => `
      <div class="card">
        <span class="card-tag">${v.tipo}</span>
        <strong style="color:#fff;">${v.titulo}</strong>
        <p style="font-size:0.85rem; color:var(--accent);">${v.empresa}</p>
      </div>
    `).join('') || '<p>Sem oportunidades registradas.</p>';
  },

  renderNoticias(container, noticias) {
    container.innerHTML = noticias.map(n => `
      <article class="card">
        <span class="card-tag">${n.categoria}</span>
        <h3 class="card-title">${n.titulo}</h3>
        <p>${n.resumo}</p>
        ${n.prazo ? `<p class="card-meta">📅 Prazo: ${n.prazo}</p>` : ''}
        ${n.link_acao ? `<div class="card-actions"><a href="${n.link_acao}" target="_blank" rel="noopener noreferrer" class="btn-primary">Ver Ação</a></div>` : ''}
      </article>
    `).join('') || '<p>Nenhum comunicado disponível.</p>';
  },

  renderProjetos(container, projetos) {
    container.innerHTML = projetos.map(p => `
      <article class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="card-tag">${p.tecnologias}</span>
          ${p.status === 'pendente' ? `<span style="color:var(--warning); font-size:0.75rem;">⚠️ Aguardando Moderação</span>` : ''}
        </div>
        <h3 class="card-title">${p.titulo}</h3>
        <p>${p.descricao}</p>
        <p class="card-meta">Autores: ${p.autores}</p>
        <div class="card-actions">
          ${p.link_github ? `<a href="${p.link_github}" target="_blank" rel="noopener noreferrer" class="btn-secondary">GitHub</a>` : ''}
          ${p.link_projeto ? `<a href="${p.link_projeto}" target="_blank" rel="noopener noreferrer" class="btn-primary">Demo</a>` : ''}
        </div>
      </article>
    `).join('') || '<p>Nenhum projeto cadastrado.</p>';
  },

  renderVagas(container, vagas) {
    container.innerHTML = vagas.map(v => `
      <article class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="card-tag">${v.tipo}</span>
          ${v.status === 'pendente' ? `<span style="color:var(--warning); font-size:0.75rem;">⚠️ Em Análise</span>` : ''}
        </div>
        <h3 class="card-title">${v.titulo}</h3>
        <p style="color:var(--accent); font-weight:600;">🏢 ${v.empresa} (${v.localizacao})</p>
        ${v.remuneracao ? `<p class="card-meta">💰 Bolsa/Salário: ${v.remuneracao}</p>` : ''}
        <p class="card-meta">🛠 Requisitos: ${v.tecnologias}</p>
        <div class="card-actions">
          <a href="${v.link_candidatura}" target="_blank" rel="noopener noreferrer" class="btn-primary">Candidatar-se</a>
        </div>
      </article>
    `).join('') || '<p>Nenhuma oportunidade encontrada com os filtros selecionados.</p>';
  },

  renderDesafios(container, desafios) {
    container.innerHTML = desafios.map(d => `
      <article class="card">
        <span class="card-tag">Fase: ${d.fase.toUpperCase()}</span>
        <h3 class="card-title">${d.titulo}</h3>
        <p>${d.descricao}</p>
        <p class="card-meta">📝 Inscrições até: ${d.prazo_inscricao}</p>
        <p class="card-meta">🏁 Encerramento: ${d.prazo_encerramento}</p>
        ${d.link_edital ? `<div class="card-actions"><a href="${d.link_edital}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Edital Completo</a></div>` : ''}
      </article>
    `).join('') || '<p>Nenhum desafio aberto.</p>';
  },

  renderPerfil(perfil, conquistas) {
    document.getElementById('perfil-nome').innerText = perfil.nome;
    document.getElementById('perfil-role').innerText = perfil.role.toUpperCase();
    document.getElementById('perfil-email').innerText = perfil.email;
    document.getElementById('perfil-bio').innerText = perfil.bio || 'Sem biografia informada.';
    document.getElementById('perfil-habilidades').innerText = perfil.habilidades || 'Nenhuma competência cadastrada.';

    // Links sociais
    const githubLink = document.getElementById('perfil-github-link');
    const linkedinLink = document.getElementById('perfil-linkedin-link');

    if (perfil.github_url) {
      githubLink.href = perfil.github_url;
      githubLink.style.display = 'inline-block';
    } else {
      githubLink.style.display = 'none';
    }

    if (perfil.linkedin_url) {
      linkedinLink.href = perfil.linkedin_url;
      linkedinLink.style.display = 'inline-block';
    } else {
      linkedinLink.style.display = 'none';
    }

    const badgesCard = document.querySelector('.profile-badges-card');

    if (perfil.role === 'empresa') {
      badgesCard.innerHTML = `
        <h3>Painel da Empresa Parceira 🏢</h3>
        <p class="card-meta">Sua organização está autorizada a submeter oportunidades diretamente ao mural.</p>
        <div style="margin-top: 1.5rem;">
          <button id="btn-open-vaga-modal-perfil" class="btn-primary">+ Divulgar Nova Oportunidade</button>
        </div>
      `;
      document.getElementById('btn-open-vaga-modal-perfil')?.addEventListener('click', () => {
        document.getElementById('modal-vaga').showModal();
      });
      return;
    }

    const badgesContainer = document.getElementById('badges-container');
    if (!conquistas || conquistas.length === 0) {
      badgesContainer.innerHTML = `<p style="font-size:0.85rem;">Nenhuma badge desbloqueada ainda. Submeta projetos na vitrine!</p>`;
      return;
    }

    badgesContainer.innerHTML = conquistas.map(c => `
      <div class="badge-item">
        <div class="badge-icon">${c.badges.icone}</div>
        <div class="badge-name">${c.badges.nome}</div>
        <div class="badge-desc">${c.badges.descricao}</div>
      </div>
    `).join('');
  }
};