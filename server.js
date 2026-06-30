const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Constructor.io API key for Coto Digital
const CONSTRUCTOR_API_KEY = 'key_r6xzz4IAoTWcipni';

/**
 * Searches for a product by PLU or EAN using Constructor.io API
 */
app.get('/api/search', async (req, res) => {
  const query = req.query.plu;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, error: 'Código PLU/EAN no provisto' });
  }

  const rawQuery = query.trim();
  if (rawQuery.length === 0) {
    return res.status(400).json({ success: false, error: 'Código PLU/EAN no válido' });
  }

  // Clean the query:
  // If it's a numeric code up to 8 digits, strip leading zeros (Constructor.io indexes them as integers).
  // If it's an EAN-13, keep it as is.
  let cleanedQuery = rawQuery;
  if (/^\d+$/.test(rawQuery)) {
    if (rawQuery.length <= 8) {
      cleanedQuery = rawQuery.replace(/^0+/, '');
      if (cleanedQuery === '') {
        cleanedQuery = '0';
      }
    }
  }

  try {
    const url = `https://ac.cnstrc.com/search/${encodeURIComponent(cleanedQuery)}?key=${CONSTRUCTOR_API_KEY}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 5000 // 5 seconds timeout
    });

    const searchResponse = response.data.response;
    const results = searchResponse.results || [];

    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    // Try to find the exact match by PLU or EAN
    let matchedProduct = null;
    const queryAsInt = parseInt(cleanedQuery, 10);

    for (const item of results) {
      const itemPlu = item.data.sku_plu;
      const itemEan = item.data.product_main_ean ? String(item.data.product_main_ean) : '';
      const itemId = item.data.id ? String(item.data.id) : '';

      // Check if PLU matches (as numbers or strings)
      const matchesPlu = (itemPlu !== undefined && (itemPlu === queryAsInt || String(itemPlu) === cleanedQuery || String(itemPlu) === rawQuery));
      
      // Check if EAN matches
      const matchesEan = (itemEan === rawQuery || itemEan === cleanedQuery);

      // Check if ID matches (e.g. prod00251876 matches 00251876 or 251876)
      const matchesId = (itemId.toLowerCase().endsWith(rawQuery.toLowerCase()) || itemId.toLowerCase().endsWith(cleanedQuery.toLowerCase()));

      if (matchesPlu || matchesEan || matchesId) {
        matchedProduct = item;
        break;
      }
    }

    // Fallback to the first result if no exact match is identified
    if (!matchedProduct) {
      matchedProduct = results[0];
    }

    // Extract relevant data
    const title = matchedProduct.value || matchedProduct.data.sku_description || 'Sin título';
    const ean = matchedProduct.data.product_main_ean || 'No disponible';
    const plu = matchedProduct.data.sku_plu || 'No disponible';

    return res.json({
      success: true,
      title,
      ean,
      plu
    });

  } catch (error) {
    console.error('Error fetching from Constructor.io:', error.message);
    
    // Check if it's a 404 from Constructor.io
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }
    
    return res.status(500).json({ success: false, error: 'Error al consultar el catálogo de Coto' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
