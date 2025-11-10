const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração CORS permissiva (sem bloqueios)
app.use(cors({
  origin: '*', // Permite qualquer origem
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Todos os métodos HTTP
  allowedHeaders: '*', // Permite qualquer header
  credentials: false, // Não precisa de credenciais
  optionsSuccessStatus: 200
}));

// Headers adicionais para garantir compatibilidade total
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// Middleware
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static('public'));

// Rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Endpoint para listar arquivos disponíveis
app.get('/api/list/:type', (req, res) => {
  const type = req.params.type; // news, books, ads, avatars
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Data Server rodando em http://localhost:${PORT}`);
  console.log(`♾️ Sistema infinito ativado`);
  console.log(`🌐 CORS totalmente liberado - sem restrições`);
  console.log(`📰 News: http://localhost:${PORT}/news/news1.json, news2.json, ...`);
  console.log(`📚 Books: http://localhost:${PORT}/books/book1.json, book2.json, ...`);
  console.log(`📢 Ads: http://localhost:${PORT}/advertisements/ad1.json, ad2.json, ...`);
  console.log(`👤 Avatars: http://localhost:${PORT}/avatars/avatar1.json, avatar2.json, ...`);
});