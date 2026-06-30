document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('plu-input');
  const button = document.getElementById('search-button');
  const errorContainer = document.getElementById('error-message');
  const productCard = document.getElementById('product-card');
  const productTitle = document.getElementById('product-title');
  const productEan = document.getElementById('product-ean');
  const productPlu = document.getElementById('product-plu');

  // Keep input focused at all times
  input.focus();
  document.addEventListener('click', () => {
    // If user clicks anywhere on the screen, focus back to the input
    // (unless they are selecting text inside the card)
    const selection = window.getSelection().toString();
    if (!selection) {
      input.focus();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const pluCode = input.value.trim();
    if (!pluCode) return;

    // Reset UI states
    button.disabled = true;
    button.textContent = 'Buscando...';
    errorContainer.classList.add('hidden');
    productCard.classList.add('hidden');

    try {
      const response = await fetch(`/api/search?plu=${encodeURIComponent(pluCode)}`);
      const data = await response.json();

      if (response.ok && data.success) {
        // Render product data
        productTitle.textContent = data.title;
        productEan.textContent = data.ean;
        productPlu.textContent = data.plu;
        
        // Show product card
        productCard.classList.remove('hidden');
      } else {
        // Show error message
        errorContainer.textContent = data.error || 'Producto no encontrado';
        errorContainer.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Search error:', err);
      errorContainer.textContent = 'Error de conexión con el servidor';
      errorContainer.classList.remove('hidden');
    } finally {
      // Re-enable UI states
      button.disabled = false;
      button.textContent = 'Buscar';
      
      // Select input content so the next barcode scan or type instantly overwrites it
      input.focus();
      input.select();
    }
  });
});
