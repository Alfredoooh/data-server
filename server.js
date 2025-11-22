// server.js
const express = require('express');
const bodyParser = require('body-parser');
const brain = require('brain.js');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const modelPath = path.join(__dirname, 'models', 'chat-model.json');

let net = null;
if (fs.existsSync(modelPath)) {
  const json = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  net = new brain.recurrent.LSTM();
  net.fromJSON(json);
  console.log('Modelo carregado:', modelPath);
} else {
  console.warn('Modelo não encontrado. Executa `npm run train` para criar models/chat-model.json');
}

app.get('/', (req, res) => res.send('API de Chat Local — POST /generate { "prompt": "..." }'));

app.post('/generate', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!net) return res.status(500).json({ error: 'Modelo não carregado. Executa npm run train' });

  try {
    const out = net.run(prompt);
    return res.json({ text: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});