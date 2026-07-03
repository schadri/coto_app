document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('plu-input');
  const button = document.getElementById('search-button');
  const errorContainer = document.getElementById('error-message');
  const productCard = document.getElementById('product-card');
  const productTitle = document.getElementById('product-title');
  const productEan = document.getElementById('product-ean');
  const productPlu = document.getElementById('product-plu');
  const barcodeContainer = document.getElementById('barcode-container');

  // Manual registration elements
  const registerContainer = document.getElementById('register-container');
  const registerForm = document.getElementById('register-form');
  const registerPluInput = document.getElementById('register-plu');
  const registerTitleInput = document.getElementById('register-title-input');
  const registerEanInput = document.getElementById('register-ean-input');

  // Link EAN elements
  const linkEanContainer = document.getElementById('link-ean-container');
  const linkEanForm = document.getElementById('link-ean-form');
  const linkEanInput = document.getElementById('link-ean-input');

  // Autofocus input on initial page load
  input.focus();

  // Auto-select text when user taps on the input to search again
  input.addEventListener('focus', () => {
    input.select();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const pluCode = input.value.trim();
    if (!pluCode) return;

    // Close the virtual keyboard on mobile by blurring the input
    input.blur();

    // Reset UI states
    button.disabled = true;
    button.textContent = 'Buscando...';
    errorContainer.classList.add('hidden');
    productCard.classList.add('hidden');
    barcodeContainer.classList.add('hidden');
    registerContainer.classList.add('hidden');
    linkEanContainer.classList.add('hidden');

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

        // Check if EAN is missing and needs registration
        if (data.ean === 'No disponible') {
          linkEanContainer.classList.remove('hidden');
          linkEanInput.value = '';
        } else {
          // Generate barcode dynamically if a valid EAN-13 code is available
          try {
            barcodeContainer.classList.remove('hidden');
            JsBarcode("#barcode", String(data.ean), {
              format: "EAN13",
              flat: true,
              width: 2.2,
              height: 70,
              displayValue: true,
              fontSize: 16,
              font: "Inter",
              background: "#ffffff",
              lineColor: "#000000"
            });
          } catch (barcodeErr) {
            console.error('Error generating barcode:', barcodeErr);
            barcodeContainer.classList.add('hidden');
          }
        }
      } else {
        // Show error message
        errorContainer.textContent = data.error || 'Producto no encontrado';
        errorContainer.classList.remove('hidden');

        // Check if we can register the PLU manually
        if (data.canRegister) {
          registerContainer.classList.remove('hidden');
          registerPluInput.value = data.plu;
          registerTitleInput.value = '';
          registerEanInput.value = '';
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      errorContainer.textContent = 'Error de conexión con el servidor';
      errorContainer.classList.remove('hidden');
    } finally {
      // Re-enable UI states
      button.disabled = false;
      button.textContent = 'Buscar';
    }
  });

  // Handle manual product registration form submit
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const plu = registerPluInput.value;
    const title = registerTitleInput.value.trim();
    const ean = registerEanInput.value.trim();

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plu, title, ean })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // Success: re-trigger search for the PLU to display it
        input.value = plu;
        form.dispatchEvent(new Event('submit'));
      } else {
        alert(data.error || 'Error al registrar el producto');
      }
    } catch (err) {
      console.error('Registration error:', err);
      alert('Error de conexión al registrar el producto');
    }
  });

  // Handle linking EAN to an existing product
  linkEanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const plu = productPlu.textContent;
    const title = productTitle.textContent;
    const ean = linkEanInput.value.trim();

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plu, title, ean })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // Success: re-trigger search for the PLU to display it with the barcode
        form.dispatchEvent(new Event('submit'));
      } else {
        alert(data.error || 'Error al vincular el código EAN');
      }
    } catch (err) {
      console.error('Linking EAN error:', err);
      alert('Error de conexión al vincular el código EAN');
    }
  });

  // ==========================================
  // OBFUSCATED CALCULATOR LOGIC
  // ==========================================
  
  const calcToggleBtn = document.getElementById('calc-toggle-btn');
  const calculatorOverlay = document.getElementById('calculator-overlay');
  const calcExitBtn = document.getElementById('calc-exit-btn');
  const calcDisplay = document.getElementById('calc-display');
  const calcFormula = document.getElementById('calc-formula');
  const calcButtons = document.querySelectorAll('.calc-btn');

  // Toggle Calculator View (Show)
  calcToggleBtn.addEventListener('click', () => {
    input.blur(); // Hide soft keyboard
    calculatorOverlay.classList.remove('hidden');
  });

  // Toggle Calculator View (Hide & Return to Stock App)
  calcExitBtn.addEventListener('click', () => {
    calculatorOverlay.classList.add('hidden');
    setTimeout(() => {
      input.focus(); // Re-focus search input
    }, 100);
  });

  let calcInput = '0';
  let calcFormulaText = '';
  let calcHasCalculated = false;

  function formatDisplayExpression(expr) {
    return expr
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/\+/g, ' + ')
      .replace(/-/g, ' - ')
      .replace(/\./g, ',');
  }

  function updateCalcDisplay() {
    calcDisplay.textContent = formatDisplayExpression(calcInput);
    calcFormula.textContent = formatDisplayExpression(calcFormulaText);
  }

  calcButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Ignore click on placeholder buttons
      if (btn.classList.contains('placeholder-btn')) return;

      const val = btn.getAttribute('data-val');

      if (val === 'AC') {
        calcInput = '0';
        calcFormulaText = '';
        calcHasCalculated = false;
      } else if (val === 'back') {
        calcFormulaText = ''; // Clear formula on backspace
        if (calcHasCalculated) {
          calcInput = '0';
          calcHasCalculated = false;
        } else {
          calcInput = calcInput.slice(0, -1);
          if (calcInput === '' || calcInput === '-') {
            calcInput = '0';
          }
        }
      } else if (val === '=') {
        try {
          let expression = calcInput;
          // Trim trailing operator if incomplete
          if (/[+\-*/]$/.test(expression)) {
            expression = expression.slice(0, -1);
          }
          
          // Secure calculation using basic operators
          if (/^[0-9+\-*/.]*$/.test(expression) && expression !== '') {
            let result = Function(`"use strict"; return (${expression})`)();
            
            if (result !== undefined && !isNaN(result) && isFinite(result)) {
              calcFormulaText = expression; // Save the formula
              // Round to avoid floating point bugs
              if (Number.isInteger(result)) {
                calcInput = String(result);
              } else {
                calcInput = String(Number(result.toFixed(8)));
              }
              calcHasCalculated = true;
            } else {
              calcInput = 'Error';
              calcFormulaText = '';
              calcHasCalculated = true;
            }
          } else {
            calcInput = '0';
            calcFormulaText = '';
          }
        } catch (err) {
          console.error('Calculo fallido:', err);
          calcInput = 'Error';
          calcFormulaText = '';
          calcHasCalculated = true;
        }
      } else {
        // Operator or number key
        const isOperator = ['+', '-', '*', '/'].includes(val);

        if (calcInput === 'Error') {
          calcInput = val === '.' ? '0.' : val;
          calcFormulaText = '';
          calcHasCalculated = false;
        } else if (calcHasCalculated) {
          calcFormulaText = ''; // Clear formula display for new calculation
          if (isOperator) {
            // Append operator to the previous result
            calcInput = calcInput + val;
          } else {
            // Start fresh with the number
            calcInput = val === '.' ? '0.' : val;
          }
          calcHasCalculated = false;
        } else {
          // Appending to an ongoing calculation
          const lastChar = calcInput.slice(-1);
          const lastIsOperator = ['+', '-', '*', '/'].includes(lastChar);
          
          if (isOperator && lastIsOperator) {
            // Replace trailing operator
            calcInput = calcInput.slice(0, -1) + val;
          } else if (val === '.') {
            // Block multiple decimals in same float
            const numbers = calcInput.split(/[+\-*/]/);
            const currentNum = numbers[numbers.length - 1];
            if (!currentNum.includes('.')) {
              calcInput += val;
            }
          } else {
            // Append digits/operators
            if (calcInput === '0' && !isOperator) {
              calcInput = val;
            } else {
              calcInput += val;
            }
          }
        }
      }

      updateCalcDisplay();
    });
  });
});
