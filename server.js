const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURAÇÃO DE SEGURANÇA
// ============================================

// Chave de API (mude para uma chave secreta sua!)
const API_KEY = process.env.API_KEY || 'sua-chave-secreta-aqui-mude-isso';

// Middleware de autenticação
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key is required',
      hint: 'Add X-API-Key header or ?api_key=DataHub2025SecureKey!@#$% to the request'
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
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentado para permitir imagens base64
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos
app.use(express.static('public'));

// Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

// Gerar ID único
const generateId = (prefix = 'item') => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
};

// Obter próximo número de arquivo
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

// Salvar dados em arquivo JSON
const saveToFile = (type, data, fileNumber = null) => {
  const dirPath = path.join(__dirname, 'public', type);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const number = fileNumber || getNextFileNumber(type);
  const fileName = `${type.replace(/s$/, '')}${number}.json`;
  const filePath = path.join(dirPath, fileName);
  
  // Criar estrutura do arquivo
  const fileData = {
    [type === 'news' ? 'articles' : type]: [data],
    metadata: {
      version: '1.0.0',
      fileNumber: number,
      totalItems: 1,
      lastUpdated: new Date().toISOString()
    }
  };
  
  fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
  
  return { fileName, filePath, fileNumber: number };
};

// Adicionar item a arquivo existente
const appendToFile = (type, data, fileNumber) => {
  const dirPath = path.join(__dirname, 'public', type);
  const fileName = `${type.replace(/s$/, '')}${fileNumber}.json`;
  const filePath = path.join(dirPath, fileName);
  
  if (!fs.existsSync(filePath)) {
    return saveToFile(type, data, fileNumber);
  }
  
  const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const dataKey = type === 'news' ? 'articles' : type;
  
  fileContent[dataKey].push(data);
  fileContent.metadata.totalItems = fileContent[dataKey].length;
  fileContent.metadata.lastUpdated = new Date().toISOString();
  
  fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
  
  return { fileName, filePath, fileNumber };
};

// ============================================
// ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// ============================================

// Rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['read', 'write', 'api-key-auth']
  });
});

// Listar arquivos disponíveis
app.get('/api/list/:type', (req, res) => {
  const type = req.params.type;
  const dirPath = path.join(__dirname, 'public', type);

  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  const files = fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

  res.json({ 
    type,
    totalFiles: files.length,
    files 
  });
});

// ============================================
// ROTAS PROTEGIDAS (COM AUTENTICAÇÃO)
// ============================================

// POST - Adicionar Notícia
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
      file: result.fileName,
      fileNumber: result.fileNumber
    });
    
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ 
      error: 'Failed to create news article',
      details: error.message 
    });
  }
});

// POST - Adicionar Livro
app.post('/api/books', authenticateApiKey, (req, res) => {
  try {
    const { 
      title, author, description, category, coverImageURL,
      digitalPrice, physicalPrice, digitalFormat, hasPhysicalVersion,
      pages, publisher, isbn, language
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
      digitalFormat: digitalFormat || 'PDF',
      hasPhysicalVersion: hasPhysicalVersion || false,
      pages: pages || 0,
      publisher: publisher || '',
      publicationYear: new Date().getFullYear().toString(),
      isbn: isbn || '',
      language: language || 'Português',
      downloadInfo: 'Download disponível após compra',
      sellerName: 'Marketplace',
      rating: 0,
      totalReviews: 0
    };
    
    const result = saveToFile('books', book);
    
    res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: book,
      file: result.fileName,
      fileNumber: result.fileNumber
    });
    
  } catch (error) {
    console.error('Error creating book:', error);
    res.status(500).json({ 
      error: 'Failed to create book',
      details: error.message 
    });
  }
});

// POST - Adicionar Anúncio
app.post('/api/advertisements', authenticateApiKey, (req, res) => {
  try {
    const { 
      title, description, imageUrl, actionUrl, actionText,
      category, backgroundColor, priority, isActive, startDate, endDate
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
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date(Date.now() + 365*24*60*60*1000).toISOString()
    };
    
    const result = saveToFile('advertisements', ad);
    
    res.status(201).json({
      success: true,
      message: 'Advertisement created successfully',
      data: ad,
      file: result.fileName,
      fileNumber: result.fileNumber
    });
    
  } catch (error) {
    console.error('Error creating advertisement:', error);
    res.status(500).json({ 
      error: 'Failed to create advertisement',
      details: error.message 
    });
  }
});

// POST - Adicionar Avatar
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
      color: color || '#1877F2'
    };
    
    const result = saveToFile('avatars', avatar);
    
    res.status(201).json({
      success: true,
      message: 'Avatar created successfully',
      data: avatar,
      file: result.fileName,
      fileNumber: result.fileNumber
    });
    
  } catch (error) {
    console.error('Error creating avatar:', error);
    res.status(500).json({ 
      error: 'Failed to create avatar',
      details: error.message 
    });
  }
});

// DELETE - Deletar item (requer API key)
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

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/list/:type',
      'POST /api/news (requires API key)',
      'POST /api/books (requires API key)',
      'POST /api/advertisements (requires API key)',
      'POST /api/avatars (requires API key)',
      'DELETE /api/:type/:id (requires API key)'
    ]
  });
});

// Error handler
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
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 DATA SERVER WITH POST API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🔑 API Key: ${API_KEY}`);
  console.log('');
  console.log('📖 READ Endpoints (Public):');
  console.log('   GET /health');
  console.log('   GET /api/list/:type');
  console.log('   GET /news/news1.json');
  console.log('   GET /books/book1.json');
  console.log('');
  console.log('✍️ WRITE Endpoints (Require API Key):');
  console.log('   POST /api/news');
  console.log('   POST /api/books');
  console.log('   POST /api/advertisements');
  console.log('   POST /api/avatars');
  console.log('   DELETE /api/:type/:id');
  console.log('');
  console.log('🔐 Authentication:');
  console.log('   Header: X-API-Key: YOUR_KEY');
  console.log('   Query: ?api_key=YOUR_KEY');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});