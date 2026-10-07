import { portalController } from './controllers/portalController.js';

document.addEventListener('DOMContentLoaded', () => {
  portalController.init();

  // Detecta se abriu via link de convite (#cadastro?email=...)
  const hash = window.location.hash;
  if (hash.includes('#cadastro?email=')) {
    const emailParam = decodeURIComponent(hash.split('email=')[1]);
    const modalAuth = document.getElementById('modal-auth');
    const emailInput = document.getElementById('auth-email');

    document.getElementById('link-toggle-auth').click();
    emailInput.value = emailParam;
    emailInput.readOnly = true;
    modalAuth.showModal();
  }
});