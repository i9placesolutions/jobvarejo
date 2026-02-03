// Teste de Debug para splashScale
console.log('=== TESTE SPLASH SCALE ===');

// Aguarda o DOM estar carregado
document.addEventListener('DOMContentLoaded', () => {
  // Verifica se o slider existe
  const slider = document.querySelector('input[type="range"][value*="splashScale"]');
  if (slider) {
    console.log('Slider splashScale encontrado:', slider);
    
    // Monitora mudanças no slider
    slider.addEventListener('input', (event) => {
      console.log('Mudança no splashScale:', event.target.value);
    });
  } else {
    console.log('Slider splashScale NÃO encontrado');
  }
});