import { portalController } from './controllers/portalController.js';

document.addEventListener('DOMContentLoaded', () => {
  portalController.init();

  // Detecção de link de convite na URL (#cadastro?email=...)
  const hash = window.location.hash;
  if (hash.includes('#cadastro?email=')) {
    const emailParam = decodeURIComponent(hash.split('email=')[1]);
    const modalAuth = document.getElementById('modal-auth');
    const emailInput = document.getElementById('auth-email');

    // Abre o modal diretamente no modo de cadastro
    document.getElementById('link-toggle-auth').click();
    emailInput.value = emailParam;
    emailInput.readOnly = true;
    modalAuth.showModal();
  }
});