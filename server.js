const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS TOTALMENTE LIBERADO
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
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

// Listagem dinâmica dos arquivos JSON
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

// Start
app.listen(PORT, () => {
  console.log(`🚀 Data Server rodando em http://localhost:${PORT}`);
  console.log(`🌐 CORS liberado: Access-Control-Allow-Origin: *`);
  console.log(`📰 News: /news/news1.json`);
  console.log(`📚 Books: /books/book1.json`);
  console.log(`📢 Ads: /advertisements/ad1.json`);
  console.log(`👤 Avatars: /avatars/avatar1.json`);
});