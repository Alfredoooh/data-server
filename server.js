// server.js
// Express API simples que carrega o modelo treinado e responde a /generate
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const brain = require('brain.js');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_SECRET = process.env.API_SECRET || ''; // se definido, exige Authorization: Bearer <API_SECRET>
const MODEL_PATH = path.join(__dirname, 'models', 'chat-model.json');

const app = express();

// CORS: permitir todas as origens (dev). Em produção define ALLOWED_ORIGIN e substitui app.use(cors()) por config com origin.
app.use(cors({
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET','POST','OPTIONS']
}));

app.use(bodyParser.json());

// Root /status
app.get('/', (req, res) => {
  return res.json({ status: 'API ONLINE' });
});

let net = null;
function loadModel() {
  if (fs.existsSync(MODEL_PATH)) {
    try {
      const json = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
      net = new brain.recurrent.LSTM();
      net.fromJSON(json);
      console.log('Modelo carregado:', MODEL_PATH);
    } catch (err) {
      console.error('Erro ao carregar modelo:', err);
      net = null;
    }
  } else {
    console.warn('Modelo não encontrado em', MODEL_PATH, '- executa "npm run train" para gerar.');
  }
}
loadModel();

// Middleware simples de autenticação (se API_SECRET estiver definido)
function checkAuth(req, res, next) {
  if (!API_SECRET) return next(); // sem segredo em dev
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${API_SECRET}`) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

app.post('/generate', checkAuth, (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });
  if (!net) return res.status(500).json({ error: 'Modelo não carregado. Executa npm run train' });

  try {
    const out = net.run(prompt);
    return res.json({ text: out });
  } catch (err) {
    console.error('Erro ao gerar:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Opcional: endpoint para recarregar o modelo sem reiniciar (útil em dev)
app.post('/_reload-model', (req, res) => {
  loadModel();
  if (net) return res.json({ ok: true, msg: 'Modelo recarregado' });
  return res.status(500).json({ ok: false, msg: 'Falha ao recarregar modelo' });
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}  (porta ${PORT})`);
});