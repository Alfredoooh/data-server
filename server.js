const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// API KEY
const API_KEY = process.env.API_KEY || 'DataHub2025SecureKey!@#$%';

// ============================================
// MIDDLEWARE - ORDEM IMPORTA!
// ============================================

// CORS primeiro - aceita tudo
app.use(cors());

// OPTIONS para preflight
app.options('*', cors());

// JSON parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logs
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Servir arquivos estáticos
app.use(express.static('public'));

// ============================================
// AUTH MIDDLEWARE
// ============================================

const requireAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ 
      error: 'Invalid or missing API key' 
    });
  }
  
  next();
};

// ============================================
// HELPERS
// ============================================

const generateId = () => {
  return `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

const getNextFileNumber = (type) => {
  const dir = path.join(__dirname, 'public', type);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return 1;
  }
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) return 1;
  
  const numbers = files.map(f => {
    const match = f.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  });
  
  return Math.max(...numbers) + 1;
};

const saveToFile = (type, data) => {
  const dir = path.join(__dirname, 'public', type);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const num = getNextFileNumber(type);
  const fileName = `${type.replace(/s$/, '')}${num}.json`;
  const filePath = path.join(dir, fileName);
  
  const dataKey = type === 'news' ? 'articles' : type;
  
  const fileData = {
    [dataKey]: [data],
    metadata: {
      version: '1.0.0',
      fileNumber: num,
      totalItems: 1,
      lastUpdated: new Date().toISOString()
    }
  };
  
  fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
  
  return fileName;
};

// ============================================
// ROTAS PÚBLICAS
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// HEALTH - IMPORTANTE!
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Listar arquivos
app.get('/api/list/:type', (req, res) => {
  try {
    const type = req.params.type;
    const dir = path.join(__dirname, 'public', type);
    
    if (!fs.existsSync(dir)) {
      return res.json({ type, totalFiles: 0, files: [] });
    }
    
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    
    res.json({ type, totalFiles: files.length, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar itens (com paginação)
app.get('/api/:type', (req, res) => {
  try {
    const type = req.params.type;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const dir = path.join(__dirname, 'public', type);
    
    if (!fs.existsSync(dir)) {
      return res.json({ 
        [type]: [], 
        total: 0, 
        page: 1, 
        limit, 
        totalPages: 0 
      });
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    let allItems = [];
    
    files.forEach(file => {
      const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const dataKey = type === 'news' ? 'articles' : type;
      allItems = allItems.concat(content[dataKey] || []);
    });
    
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const items = allItems.slice(startIdx, endIdx);
    
    res.json({
      [type]: items,
      total: allItems.length,
      page,
      limit,
      totalPages: Math.ceil(allItems.length / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar por ID
app.get('/api/:type/:id', (req, res) => {
  try {
    const { type, id } = req.params;
    const dir = path.join(__dirname, 'public', type);
    
    if (!fs.existsSync(dir)) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const dataKey = type === 'news' ? 'articles' : type;
      const item = content[dataKey].find(i => i.id === id);
      
      if (item) {
        return res.json(item);
      }
    }
    
    res.status(404).json({ error: 'Not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar
app.get('/api/:type/search', (req, res) => {
  try {
    const type = req.params.type;
    const query = (req.query.q || '').toLowerCase();
    const dir = path.join(__dirname, 'public', type);
    
    if (!fs.existsSync(dir)) {
      return res.json({ results: [], total: 0 });
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    let allItems = [];
    
    files.forEach(file => {
      const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const dataKey = type === 'news' ? 'articles' : type;
      allItems = allItems.concat(content[dataKey] || []);
    });
    
    const results = query ? allItems.filter(item => 
      (item.title && item.title.toLowerCase().includes(query)) ||
      (item.description && item.description.toLowerCase().includes(query)) ||
      (item.name && item.name.toLowerCase().includes(query))
    ) : allItems;
    
    res.json({ results, total: results.length, query });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
app.get('/api/stats', (req, res) => {
  try {
    const types = ['news', 'books', 'advertisements', 'avatars'];
    const stats = {};
    
    types.forEach(type => {
      const dir = path.join(__dirname, 'public', type);
      
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        let total = 0;
        
        files.forEach(file => {
          const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
          const dataKey = type === 'news' ? 'articles' : type;
          total += (content[dataKey] || []).length;
        });
        
        stats[type] = { files: files.length, items: total };
      } else {
        stats[type] = { files: 0, items: 0 };
      }
    });
    
    res.json({ stats, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROTAS PROTEGIDAS
// ============================================

// POST News
app.post('/api/news', requireAuth, (req, res) => {
  try {
    const { title, description, content, source, author, imageUrl, category } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description required' });
    }
    
    const article = {
      id: `news_${generateId()}`,
      title,
      description,
      content: content || description,
      source: source || 'User',
      author: author || 'Anonymous',
      imageUrl: imageUrl || null,
      category: category || 'general',
      tags: [],
      publishedAt: new Date().toISOString(),
      url: null
    };
    
    const fileName = saveToFile('news', article);
    
    res.status(201).json({
      success: true,
      message: 'Created',
      data: article,
      file: fileName
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Books
app.post('/api/books', requireAuth, (req, res) => {
  try {
    const { title, author, description, category, coverImageURL, digitalPrice, pages, language } = req.body;
    
    if (!title || !author) {
      return res.status(400).json({ error: 'title and author required' });
    }
    
    const book = {
      id: `book_${generateId()}`,
      title,
      author,
      description: description || '',
      category: category || 'Geral',
      coverImageURL: coverImageURL || null,
      digitalPrice: digitalPrice || 0,
      physicalPrice: 0,
      digitalFormat: 'PDF',
      hasPhysicalVersion: false,
      pages: pages || 0,
      publisher: 'Marketplace',
      publicationYear: new Date().getFullYear().toString(),
      isbn: '',
      language: language || 'Português',
      rating: 0,
      totalReviews: 0
    };
    
    const fileName = saveToFile('books', book);
    
    res.status(201).json({
      success: true,
      message: 'Created',
      data: book,
      file: fileName
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Ads
app.post('/api/advertisements', requireAuth, (req, res) => {
  try {
    const { title, description, imageUrl, actionUrl, actionText, backgroundColor } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description required' });
    }
    
    const ad = {
      id: `ad_${generateId()}`,
      title,
      description,
      imageUrl: imageUrl || null,
      actionUrl: actionUrl || '#',
      actionText: actionText || 'Ver Mais',
      category: 'general',
      backgroundColor: backgroundColor || '#1877F2',
      priority: 1,
      isActive: true,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString()
    };
    
    const fileName = saveToFile('advertisements', ad);
    
    res.status(201).json({
      success: true,
      message: 'Created',
      data: ad,
      file: fileName
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Avatars
app.post('/api/avatars', requireAuth, (req, res) => {
  try {
    const { name, imageUrl, category, color } = req.body;
    
    if (!name || !imageUrl) {
      return res.status(400).json({ error: 'name and imageUrl required' });
    }
    
    const avatar = {
      id: `avatar_${generateId()}`,
      name,
      imageUrl,
      category: category || 'general',
      color: color || '#1877F2'
    };
    
    const fileName = saveToFile('avatars', avatar);
    
    res.status(201).json({
      success: true,
      message: 'Created',
      data: avatar,
      file: fileName
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
app.delete('/api/:type/:id', requireAuth, (req, res) => {
  try {
    const { type, id } = req.params;
    const dir = path.join(__dirname, 'public', type);
    
    if (!fs.existsSync(dir)) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    let found = false;
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const dataKey = type === 'news' ? 'articles' : type;
      
      const original = content[dataKey].length;
      content[dataKey] = content[dataKey].filter(i => i.id !== id);
      
      if (content[dataKey].length < original) {
        found = true;
        
        if (content[dataKey].length === 0) {
          fs.unlinkSync(filePath);
        } else {
          content.metadata.totalItems = content[dataKey].length;
          content.metadata.lastUpdated = new Date().toISOString();
          fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        }
        
        break;
      }
    }
    
    if (!found) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    res.json({ success: true, message: 'Deleted', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ERROR HANDLERS
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

// ============================================
// START
// ============================================

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`🔑 API Key: ${API_KEY}\n`);
});