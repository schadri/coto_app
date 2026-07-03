const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parser for POST requests
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Constructor.io API key for Coto Digital
const CONSTRUCTOR_API_KEY = 'key_r6xzz4IAoTWcipni';

// Local cache configuration
const CACHE_FILE = path.join(__dirname, 'products_cache.json');
let localCache = {};

// Load cache from disk
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      localCache = JSON.parse(data);
      console.log('Local product cache loaded successfully.');
    } else {
      localCache = {};
      fs.writeFileSync(CACHE_FILE, JSON.stringify(localCache, null, 2), 'utf8');
      console.log('Created new empty product cache.');
    }
  } catch (err) {
    console.error('Failed to read/write product cache file:', err.message);
    localCache = {}; // Fallback in-memory
  }
}

// Save cache to disk
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(localCache, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save product cache to disk:', err.message);
  }
}

// Initial cache load
loadCache();

// Helper to fetch Coto Digital session cookies
async function fetchCotoCookies() {
  try {
    const mainResponse = await axios.get('https://www.cotodigital.com.ar/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 3000
    });
    const rawCookies = mainResponse.headers['set-cookie'] || [];
    const cookieMap = {};
    rawCookies.forEach(cookieStr => {
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
    });
    return Object.entries(cookieMap).map(([n, v]) => `${n}=${v}`).join('; ');
  } catch (err) {
    console.error('Error fetching Coto cookies:', err.message);
    return '';
  }
}

// Helper to fetch Coto ATG details (for out-of-stock fallback)
async function fetchCotoAtgDetails(plu, cookies) {
  const url = 'https://www.cotodigital.com.ar/rest/model/atg/actors/cProfileActor/getDetailsProducts';
  try {
    const pluNum = parseInt(plu, 10);
    if (isNaN(pluNum)) return null;

    const response = await axios.post(url, {
      productIds: [pluNum]
    }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'Referer': 'https://www.cotodigital.com.ar/'
      },
      timeout: 4000
    });

    if (response.data && response.data.productos && response.data.productos.length > 0) {
      const prod = response.data.productos[0];
      if (prod.nombre) {
        return {
          title: prod.nombre,
          plu: String(pluNum),
          ean: 'No disponible'
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Error querying Coto ATG details:', err.message);
    return null;
  }
}

/**
 * Searches for a product by PLU or EAN
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
  let cleanedQuery = rawQuery;
  if (/^\d+$/.test(rawQuery)) {
    if (rawQuery.length <= 8) {
      cleanedQuery = rawQuery.replace(/^0+/, '');
      if (cleanedQuery === '') {
        cleanedQuery = '0';
      }
    }
  }

  // 1. Check local cache first
  if (localCache[cleanedQuery]) {
    const cachedItem = localCache[cleanedQuery];
    console.log(`Cache HIT for query [${cleanedQuery}]:`, cachedItem.title);
    return res.json({
      success: true,
      title: cachedItem.title,
      ean: cachedItem.ean,
      plu: cachedItem.plu,
      isCached: true
    });
  }

  // 2. Query Constructor.io (Coto active search index)
  try {
    const url = `https://ac.cnstrc.com/search/${encodeURIComponent(cleanedQuery)}?key=${CONSTRUCTOR_API_KEY}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 5000
    });

    const searchResponse = response.data.response;
    const results = searchResponse.results || [];

    if (results.length > 0) {
      // Try to find the exact match by PLU or EAN
      let matchedProduct = null;
      const queryAsInt = parseInt(cleanedQuery, 10);

      for (const item of results) {
        const itemPlu = item.data.sku_plu;
        const itemEan = item.data.product_main_ean ? String(item.data.product_main_ean) : '';
        const itemId = item.data.id ? String(item.data.id) : '';

        const matchesPlu = (itemPlu !== undefined && (itemPlu === queryAsInt || String(itemPlu) === cleanedQuery || String(itemPlu) === rawQuery));
        const matchesEan = (itemEan === rawQuery || itemEan === cleanedQuery);
        const matchesId = (itemId.toLowerCase().endsWith(rawQuery.toLowerCase()) || itemId.toLowerCase().endsWith(cleanedQuery.toLowerCase()));

        if (matchesPlu || matchesEan || matchesId) {
          matchedProduct = item;
          break;
        }
      }

      if (!matchedProduct) {
        matchedProduct = results[0];
      }

      const title = matchedProduct.value || matchedProduct.data.sku_description || 'Sin título';
      const ean = matchedProduct.data.product_main_ean || 'No disponible';
      const plu = matchedProduct.data.sku_plu || 'No disponible';

      // Automatically store in cache for future offline / out-of-stock lookup
      if (plu !== 'No disponible') {
        const cacheEntry = { plu: String(plu), ean: String(ean), title };
        localCache[String(plu)] = cacheEntry;
        if (ean !== 'No disponible') {
          localCache[String(ean)] = cacheEntry;
        }
        saveCache();
      }

      return res.json({
        success: true,
        title,
        ean,
        plu,
        isCached: false
      });
    }
  } catch (error) {
    console.error('Constructor.io query failed, trying fallback...', error.message);
  }

  // 3. Fallback: Query Coto Digital's direct product details REST backend API
  // (This handles items that are out of stock or excluded from Constructor.io public search)
  if (/^\d+$/.test(cleanedQuery) && cleanedQuery.length <= 8) {
    console.log(`Attempting Coto ATG backend fallback for PLU [${cleanedQuery}]...`);
    const cookies = await fetchCotoCookies();
    const details = await fetchCotoAtgDetails(cleanedQuery, cookies);
    
    if (details) {
      console.log(`ATG fallback SUCCESS for PLU [${cleanedQuery}]:`, details.title);
      // Store in cache (EAN remains 'No disponible' until manually registered)
      localCache[cleanedQuery] = details;
      saveCache();
      
      return res.json({
        success: true,
        title: details.title,
        ean: details.ean,
        plu: details.plu,
        isCached: false,
        needsEanRegistration: true
      });
    }
  }

  // 4. If everything fails
  return res.status(404).json({ 
    success: false, 
    error: 'Producto no encontrado en el catálogo de Coto',
    canRegister: true, // Signal to frontend to show manual registration
    plu: cleanedQuery
  });
});

/**
 * Manually registers/links a PLU and EAN code
 */
app.post('/api/register', (req, res) => {
  const { plu, title, ean } = req.body;

  if (!plu || !title) {
    return res.status(400).json({ success: false, error: 'PLU y Título son requeridos' });
  }

  const cleanedPlu = String(plu).trim().replace(/^0+/, '');
  const cleanedTitle = String(title).trim();
  const cleanedEan = ean ? String(ean).trim() : 'No disponible';

  if (cleanedPlu === '') {
    return res.status(400).json({ success: false, error: 'PLU no válido' });
  }

  const cacheEntry = {
    plu: cleanedPlu,
    ean: cleanedEan,
    title: cleanedTitle
  };

  // Store under both keys for bidirectional search
  localCache[cleanedPlu] = cacheEntry;
  if (cleanedEan !== 'No disponible') {
    localCache[cleanedEan] = cacheEntry;
  }

  saveCache();
  console.log(`Manually registered product:`, cacheEntry);

  return res.json({ success: true, message: 'Producto registrado en la base de datos local' });
});

// Start server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
