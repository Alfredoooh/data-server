const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURAÇÃO
// ============================================

const API_KEY = process.env.API_KEY || 'DataHub2025SecureKey!@#$%';

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// AUTENTICAÇÃO
// ============================================

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key is required',
      hint: 'Add X-API-Key header or ?api_key=YOUR_KEY'
    });
  }

  if (apiKey !== API_KEY) {
    return res.status(403).json({ 
      error: 'Invalid API key' 
    });
  }

  next();
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

const generateId = (prefix = 'item') => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
};

const getNextFileNumber = (type) => {
  const dirPath = path.join(__dirname, 'public', type);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return 1;
  }

  const files = fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const match = file.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });

  return files.length > 0 ? Math.max(...files) + 1 : 1;
};

const saveToFile = (type, data, fileNumber = null) => {
  const dirPath = path.join(__dirname, 'public', type);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const number = fileNumber || getNextFileNumber(type);
  const fileName = `${type.replace(/s$/, '')}${number}.json`;
  const filePath = path.join(dirPath, fileName);

  const fileData = {
    [type === 'news' ? 'articles' : type]: [data],
    metadata: {
      version: '1.0.0',
      fileNumber: number,
      totalItems: 1,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }
  };

  fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));

  return { fileName, filePath, fileNumber: number };
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

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    features: ['read', 'write', 'api-key-auth', 'search', 'stats']
  });
});

// GET - Listar todos os itens de um tipo (com paginação)
app.get('/api/:type', (req, res) => {
  try {
    const type = req.params.type;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const dirPath = path.join(__dirname, 'public', type);

    if (!fs.existsSync(dirPath)) {
      return res.json({ 
        [type]: [], 
        total: 0, 
        page, 
        limit 
      });
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.json'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numB - numA;
      });

    let allItems = [];
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const dataKey = type === 'news' ? 'articles' : type;
      allItems = allItems.concat(content[dataKey] || []);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = allItems.slice(startIndex, endIndex);

    res.json({
      [type]: paginatedItems,
      total: allItems.length,
      page,
      limit,
      totalPages: Math.ceil(allItems.length / limit)
    });

  } catch (error) {
    console.error('Error listing items:', error);
    res.status(500).json({ 
      error: 'Failed to list items',
      details: error.message 
    });
  }
});

// GET - Buscar item por ID
app.get('/api/:type/:id', (req, res) => {
  try {
    const { type, id } = req.params;
    const dirPath = path.join(__dirname, 'public', type);

    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Type not found' });
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const dataKey = type === 'news' ? 'articles' : type;
      
      const item = content[dataKey].find(item => item.id === id);
      
      if (item) {
        return res.json(item);
      }
    }

    res.status(404).json({ error: 'Item not found' });

  } catch (error) {
    console.error('Error getting item:', error);
    res.status(500).json({ 
      error: 'Failed to get item',
      details: error.message 
    });
  }
});

// GET - Buscar itens (search)
app.get('/api/:type/search', (req, res) => {
  try {
    const type = req.params.type;
    const query = req.query.q?.toLowerCase();
    const category = req.query.category;
    const dirPath = path.join(__dirname, 'public', type);

    if (!fs.existsSync(dirPath)) {
      return res.json({ results: [], total: 0 });
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    let allItems = [];

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const dataKey = type === 'news' ? 'articles' : type;
      allItems = allItems.concat(content[dataKey] || []);
    }

    let results = allItems;

    if (query) {
      results = results.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.name?.toLowerCase().includes(query)
      );
    }

    if (category) {
      results = results.filter(item => item.category === category);
    }

    res.json({
      results,
      total: results.length,
      query,
      category
    });

  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ 
      error: 'Failed to search',
      details: error.message 
    });
  }
});

// GET - Estatísticas
app.get('/api/stats', (req, res) => {
  try {
    const types = ['news', 'books', 'advertisements', 'avatars'];
    const stats = {};

    types.forEach(type => {
      const dirPath = path.join(__dirname, 'public', type);
      
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
        let totalItems = 0;

        files.forEach(file => {
          const content = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8'));
          const dataKey = type === 'news' ? 'articles' : type;
          totalItems += (content[dataKey] || []).length;
        });

        stats[type] = {
          files: files.length,
          items: totalItems
        };
      } else {
        stats[type] = { files: 0, items: 0 };
      }
    });

    res.json({
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ 
      error: 'Failed to get stats',
      details: error.message 
    });
  }
});

// ============================================
// ROTAS PROTEGIDAS
// ============================================

// POST - Criar notícia
app.post('/api/news', authenticateApiKey, (req, res) => {
  try {
    const { title, description, content, source, author, imageUrl, category, tags, url } = req.body;

    if (!title || !description) {
      return res.status(400).json({ 
        error: 'title and description are required' 
      });
    }

    const article = {
      id: generateId('news'),
      title,
      description,
      content: content || description,
      source: source || 'User Submission',
      author: author || 'Anonymous',
      imageUrl: imageUrl || null,
      category: category || 'general',
      tags: tags || [],
      publishedAt: new Date().toISOString(),
      url: url || null
    };

    const result = saveToFile('news', article);

    res.status(201).json({
      success: true,
      message: 'News article created successfully',
      data: article,
      file: result.fileName
    });

  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ 
      error: 'Failed to create news article',
      details: error.message 
    });
  }
});

// POST - Criar livro
app.post('/api/books', authenticateApiKey, (req, res) => {
  try {
    const { 
      title, author, description, category, coverImageURL,
      digitalPrice, physicalPrice, pages, language
    } = req.body;

    if (!title || !author) {
      return res.status(400).json({ 
        error: 'title and author are required' 
      });
    }

    const book = {
      id: generateId('book'),
      title,
      author,
      description: description || '',
      category: category || 'Geral',
      coverImageURL: coverImageURL || null,
      digitalPrice: digitalPrice || 0,
      physicalPrice: physicalPrice || 0,
      pages: pages || 0,
      language: language || 'Português',
      rating: 0,
      totalReviews: 0,
      createdAt: new Date().toISOString()
    };

    const result = saveToFile('books', book);

    res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: book,
      file: result.fileName
    });

  } catch (error) {
    console.error('Error creating book:', error);
    res.status(500).json({ 
      error: 'Failed to create book',
      details: error.message 
    });
  }
});

// POST - Criar anúncio
app.post('/api/advertisements', authenticateApiKey, (req, res) => {
  try {
    const { 
      title, description, imageUrl, actionUrl, actionText,
      category, backgroundColor, priority, isActive
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ 
        error: 'title and description are required' 
      });
    }

    const ad = {
      id: generateId('ad'),
      title,
      description,
      imageUrl: imageUrl || null,
      actionUrl: actionUrl || '#',
      actionText: actionText || 'Ver Mais',
      category: category || 'general',
      backgroundColor: backgroundColor || '#1877F2',
      priority: priority || 1,
      isActive: isActive !== false,
      createdAt: new Date().toISOString()
    };

    const result = saveToFile('advertisements', ad);

    res.status(201).json({
      success: true,
      message: 'Advertisement created successfully',
      data: ad,
      file: result.fileName
    });

  } catch (error) {
    console.error('Error creating advertisement:', error);
    res.status(500).json({ 
      error: 'Failed to create advertisement',
      details: error.message 
    });
  }
});

// POST - Criar avatar
app.post('/api/avatars', authenticateApiKey, (req, res) => {
  try {
    const { name, imageUrl, category, color } = req.body;

    if (!name || !imageUrl) {
      return res.status(400).json({ 
        error: 'name and imageUrl are required' 
      });
    }

    const avatar = {
      id: generateId('avatar'),
      name,
      imageUrl,
      category: category || 'general',
      color: color || '#1877F2',
      createdAt: new Date().toISOString()
    };

    const result = saveToFile('avatars', avatar);

    res.status(201).json({
      success: true,
      message: 'Avatar created successfully',
      data: avatar,
      file: result.fileName
    });

  } catch (error) {
    console.error('Error creating avatar:', error);
    res.status(500).json({ 
      error: 'Failed to create avatar',
      details: error.message 
    });
  }
});

// DELETE - Deletar item
app.delete('/api/:type/:id', authenticateApiKey, (req, res) => {
  try {
    const { type, id } = req.params;
    const dirPath = path.join(__dirname, 'public', type);

    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Type not found' });
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    let found = false;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const dataKey = type === 'news' ? 'articles' : type;

      const originalLength = content[dataKey].length;
      content[dataKey] = content[dataKey].filter(item => item.id !== id);

      if (content[dataKey].length < originalLength) {
        found = true;
        content.metadata.totalItems = content[dataKey].length;
        content.metadata.lastUpdated = new Date().toISOString();

        if (content[dataKey].length === 0) {
          fs.unlinkSync(filePath);
        } else {
          fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        }

        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ 
      success: true,
      message: 'Item deleted successfully',
      id 
    });

  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ 
      error: 'Failed to delete item',
      details: error.message 
    });
  }
});

// ============================================
// ERROR HANDLERS
// ============================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('\n🚀 DATA SERVER RUNNING');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔑 API Key: ${API_KEY}\n`);
});