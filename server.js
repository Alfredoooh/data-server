// server.js (ESM)
import express from 'express';
import dotenv from 'dotenv';
import { getLlama } from 'node-llama-cpp';
import { Pool } from 'pg';

dotenv.config();
const PORT = process.env.PORT || 3000;
const MODEL_PATH = process.env.MODEL_PATH || './models/my-model.gguf';
const DATABASE_URL = process.env.DATABASE_URL; // Render provides DATABASE_URL

const app = express();
app.use(express.json());

const pgPool = new Pool({ connectionString: DATABASE_URL });

// bootstrap Llama
let llama, model;
async function initModel() {
  llama = await getLlama();
  model = await llama.loadModel({ modelPath: MODEL_PATH });
  console.log('Modelo carregado:', MODEL_PATH);
}
initModel().catch(err => {
  console.error('Erro ao iniciar modelo', err);
  process.exit(1);
});

// Endpoint: gerar texto
app.post('/generate', async (req, res) => {
  const { prompt, max_tokens = 256 } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    const context = await model.createContext();
    // usa LlamaChatSession (mais ergonomico) ou context.prompt direto
    const { LlamaChatSession } = await import('node-llama-cpp');
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });

    const out = await session.prompt(prompt, { maxTokens: max_tokens });
    return res.json({ text: out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

// Endpoint: ingest (gera embedding e salva no Postgres)
app.post('/ingest', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  try {
    const ectx = await model.createEmbeddingContext();
    const emb = await ectx.getEmbeddingFor(text);
    // emb.vector é um array de floats
    const client = await pgPool.connect();
    try {
      // Assumindo que pgvector está instalado e coluna é 'vector(1536)'
      await client.query(
        'INSERT INTO documents (content, embedding) VALUES ($1, $2)',
        [text, emb.vector]
      );
    } finally {
      client.release();
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});