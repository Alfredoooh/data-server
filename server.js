const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const logger = require('./utils/logger');
const AIModel = require('./models/AIModel');
const TextProcessor = require('./utils/textProcessor');
const Cache = require('./utils/cache');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS deve vir ANTES do helmet
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

// Helmet com configuração ajustada para não bloquear CORS
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Middleware para garantir que sempre retorna JSON
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Rate Limiting
const rateLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60
});

const rateLimiterMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
  }
};

// Inicialização
const aiModel = new AIModel();
const textProcessor = new TextProcessor();
const cache = new Cache();

let modelLoaded = false;

// Carregar modelo ao iniciar
(async () => {
  try {
    logger.info('Carregando modelo de IA...');
    await aiModel.loadModel();
    modelLoaded = true;
    logger.info('Modelo carregado com sucesso!');
  } catch (error) {
    logger.error('Erro ao carregar modelo:', error);
    modelLoaded = false;
  }
})();

// Middleware de verificação do modelo
const checkModel = (req, res, next) => {
  if (!modelLoaded) {
    return res.status(503).json({ 
      error: 'Modelo ainda não carregado. Tente novamente em alguns segundos.' 
    });
  }
  next();
};

// Rotas

// Health check
app.get('/health', (req, res) => {
  return res.json({
    status: 'online',
    modelLoaded,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Informações do modelo
app.get('/api/info', checkModel, (req, res) => {
  return res.json({
    name: 'AI Text Generation System',
    version: '1.0.0',
    model: aiModel.getInfo(),
    capabilities: [
      'Geração de texto',
      'Continuação de texto',
      'Resposta a perguntas',
      'Resumo de texto',
      'Análise de sentimento'
    ]
  });
});

// Geração de texto
app.post('/api/generate', rateLimiterMiddleware, checkModel, async (req, res) => {
  try {
    const { prompt, maxLength = 100, temperature = 0.8, topK = 40 } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt inválido' });
    }

    // Verificar cache
    const cacheKey = `gen:${prompt}:${maxLength}:${temperature}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ text: cached, cached: true });
    }

    logger.info(`Gerando texto para prompt: "${prompt.substring(0, 50)}..."`);

    // Processar prompt
    const processedPrompt = textProcessor.preprocess(prompt);

    // Gerar texto
    const generatedText = await aiModel.generateText(processedPrompt, {
      maxLength,
      temperature,
      topK
    });

    // Pós-processar
    const finalText = textProcessor.postprocess(generatedText);

    // Salvar no cache
    cache.set(cacheKey, finalText);

    return res.json({
      text: finalText,
      metadata: {
        promptLength: prompt.length,
        generatedLength: finalText.length,
        temperature,
        maxLength
      }
    });

  } catch (error) {
    logger.error('Erro na geração:', error);
    return res.status(500).json({ error: 'Erro ao gerar texto', details: error.message });
  }
});

// Análise de sentimento
app.post('/api/analyze', rateLimiterMiddleware, checkModel, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto inválido' });
    }

    const sentiment = textProcessor.analyzeSentiment(text);
    const entities = textProcessor.extractEntities(text);
    const keywords = textProcessor.extractKeywords(text);

    return res.json({
      sentiment,
      entities,
      keywords,
      stats: {
        length: text.length,
        words: text.split(/\s+/).length,
        sentences: text.split(/[.!?]+/).length
      }
    });

  } catch (error) {
    logger.error('Erro na análise:', error);
    return res.status(500).json({ error: 'Erro ao analisar texto', details: error.message });
  }
});

// Resumo de texto
app.post('/api/summarize', rateLimiterMiddleware, checkModel, async (req, res) => {
  try {
    const { text, sentences = 3 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto inválido' });
    }

    const summary = textProcessor.summarize(text, sentences);

    return res.json({
      summary,
      original_length: text.length,
      summary_length: summary.length,
      compression_ratio: (summary.length / text.length * 100).toFixed(2) + '%'
    });

  } catch (error) {
    logger.error('Erro no resumo:', error);
    return res.status(500).json({ error: 'Erro ao resumir texto', details: error.message });
  }
});

// Treinamento (endpoint protegido)
app.post('/api/train', rateLimiterMiddleware, async (req, res) => {
  try {
    const { texts, epochs = 10, batchSize = 32 } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'Dados de treinamento inválidos' });
    }

    logger.info(`Iniciando treinamento com ${texts.length} textos`);

    const result = await aiModel.train(texts, { epochs, batchSize });

    return res.json({
      message: 'Treinamento concluído',
      result,
      trained_samples: texts.length
    });

  } catch (error) {
    logger.error('Erro no treinamento:', error);
    return res.status(500).json({ error: 'Erro ao treinar modelo', details: error.message });
  }
});

// Completar texto
app.post('/api/complete', rateLimiterMiddleware, checkModel, async (req, res) => {
  try {
    const { text, numSuggestions = 3 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto inválido' });
    }

    const suggestions = await aiModel.complete(text, numSuggestions);

    return res.json({
      suggestions,
      original: text
    });

  } catch (error) {
    logger.error('Erro na completação:', error);
    return res.status(500).json({ error: 'Erro ao completar texto', details: error.message });
  }
});

// Limpar cache
app.post('/api/cache/clear', (req, res) => {
  cache.clear();
  return res.json({ message: 'Cache limpo com sucesso' });
});

// Estatísticas do cache
app.get('/api/cache/stats', (req, res) => {
  return res.json(cache.stats());
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Erro não tratado:', err);
  return res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Erro desconhecido'
  });
});

// 404 handler
app.use((req, res) => {
  return res.status(404).json({ error: 'Rota não encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`🚀 Servidor rodando na porta ${PORT}`);
  logger.info(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🤖 Modelo: ${modelLoaded ? 'Carregado' : 'Carregando...'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido. Encerrando graciosamente...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recebido. Encerrando graciosamente...');
  process.exit(0);
});

module.exports = app;