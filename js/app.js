import { portalController } from './controllers/portalController.js';

// Inicialização imediata após carga do DOM
document.addEventListener('DOMContentLoaded', () => {
  portalController.init();
});