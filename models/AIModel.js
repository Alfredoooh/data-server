const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');

class AIModel {
  constructor() {
    this.model = null;
    this.tokenizer = null;
    this.vocabulary = new Map();
    this.reverseVocabulary = new Map();
    this.maxSequenceLength = 50;
    this.embeddingDim = 128;
    this.vocabSize = 10000;
    this.modelPath = path.join(__dirname, '../saved_model');
    this.vocabPath = path.join(__dirname, '../vocabulary.json');
  }

  createModel() {
    const model = tf.sequential();

    model.add(tf.layers.embedding({
      inputDim: this.vocabSize,
      outputDim: this.embeddingDim,
      inputLength: this.maxSequenceLength
    }));

    model.add(tf.layers.lstm({
      units: 256,
      returnSequences: true,
      dropout: 0.2,
      recurrentDropout: 0.2
    }));

    model.add(tf.layers.lstm({
      units: 256,
      dropout: 0.2,
      recurrentDropout: 0.2
    }));

    model.add(tf.layers.dense({
      units: 512,
      activation: 'relu'
    }));

    model.add(tf.layers.dropout({ rate: 0.3 }));

    model.add(tf.layers.dense({
      units: this.vocabSize,
      activation: 'softmax'
    }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    console.log('Modelo criado com sucesso');
    return model;
  }

  buildVocabulary(texts) {
    const wordFreq = new Map();

    texts.forEach(text => {
      const words = text.toLowerCase().split(/\s+/);
      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });
    });

    const sortedWords = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.vocabSize - 3);

    this.vocabulary.set('<PAD>', 0);
    this.vocabulary.set('<UNK>', 1);
    this.vocabulary.set('<START>', 2);

    this.reverseVocabulary.set(0, '<PAD>');
    this.reverseVocabulary.set(1, '<UNK>');
    this.reverseVocabulary.set(2, '<START>');

    sortedWords.forEach(([word], idx) => {
      const tokenId = idx + 3;
      this.vocabulary.set(word, tokenId);
      this.reverseVocabulary.set(tokenId, word);
    });

    console.log(`Vocabulário construído: ${this.vocabulary.size} tokens`);
  }

  tokenize(text) {
    const words = text.toLowerCase().split(/\s+/);
    return words.map(word => this.vocabulary.get(word) || 1);
  }

  detokenize(tokens) {
    return tokens
      .map(token => this.reverseVocabulary.get(token) || '<UNK>')
      .filter(word => word !== '<PAD>' && word !== '<START>')
      .join(' ');
  }

  prepareTrainingData(texts) {
    const sequences = [];
    const labels = [];

    texts.forEach(text => {
      const tokens = this.tokenize(text);

      for (let i = 0; i < tokens.length - 1; i++) {
        const sequence = tokens.slice(Math.max(0, i - this.maxSequenceLength + 1), i + 1);
        const label = tokens[i + 1];

        while (sequence.length < this.maxSequenceLength) {
          sequence.unshift(0);
        }

        sequences.push(sequence);
        labels.push(label);
      }
    });

    return { sequences, labels };
  }

  async train(texts, options = {}) {
    const { epochs = 10, batchSize = 32, validationSplit = 0.2 } = options;

    try {
      console.log('Iniciando treinamento...');

      this.buildVocabulary(texts);

      if (!this.model) {
        this.model = this.createModel();
      }

      const { sequences, labels } = this.prepareTrainingData(texts);

      const xs = tf.tensor2d(sequences, [sequences.length, this.maxSequenceLength]);
      const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), this.vocabSize);

      const history = await this.model.fit(xs, ys, {
        epochs,
        batchSize,
        validationSplit,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Época ${epoch + 1}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}`);
          }
        }
      });

      xs.dispose();
      ys.dispose();

      await this.saveModel();

      console.log('Treinamento concluído!');
      return history;

    } catch (error) {
      console.error('Erro no treinamento:', error);
      throw error;
    }
  }

  async generateText(prompt, options = {}) {
    const { maxLength = 100, temperature = 0.8, topK = 40 } = options;

    if (!this.model) {
      throw new Error('Modelo não carregado');
    }

    let tokens = this.tokenize(prompt);
    const generatedTokens = [...tokens];

    for (let i = 0; i < maxLength; i++) {
      const sequence = generatedTokens.slice(-this.maxSequenceLength);
      while (sequence.length < this.maxSequenceLength) {
        sequence.unshift(0);
      }

      const inputTensor = tf.tensor2d([sequence], [1, this.maxSequenceLength]);
      const predictions = this.model.predict(inputTensor);

      const scaledPredictions = tf.div(predictions, temperature);
      const probabilities = tf.softmax(scaledPredictions);

      const topKProbs = await this.topKSampling(probabilities, topK);
      const nextToken = await this.sampleFromDistribution(topKProbs);

      generatedTokens.push(nextToken);

      inputTensor.dispose();
      predictions.dispose();
      scaledPredictions.dispose();
      probabilities.dispose();

      if (nextToken === 0 || nextToken === 1) break;
    }

    return this.detokenize(generatedTokens);
  }

  async topKSampling(probabilities, k) {
    const probs = await probabilities.array();
    const flatProbs = probs[0];

    const indices = flatProbs
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p - a.p)
      .slice(0, k);

    const sum = indices.reduce((s, { p }) => s + p, 0);
    const normalized = indices.map(({ p, i }) => ({ p: p / sum, i }));

    return normalized;
  }

  async sampleFromDistribution(distribution) {
    const random = Math.random();
    let cumulative = 0;

    for (const { p, i } of distribution) {
      cumulative += p;
      if (random < cumulative) {
        return i;
      }
    }

    return distribution[distribution.length - 1].i;
  }

  async complete(text, numSuggestions = 3) {
    const suggestions = [];

    for (let i = 0; i < numSuggestions; i++) {
      const completion = await this.generateText(text, {
        maxLength: 20,
        temperature: 0.7 + i * 0.1
      });
      suggestions.push(completion);
    }

    return suggestions;
  }

  async saveModel() {
    try {
      await this.model.save(`file://${this.modelPath}`);

      const vocabData = {
        vocabulary: Array.from(this.vocabulary.entries()),
        reverseVocabulary: Array.from(this.reverseVocabulary.entries()),
        maxSequenceLength: this.maxSequenceLength,
        vocabSize: this.vocabSize
      };

      await fs.writeFile(this.vocabPath, JSON.stringify(vocabData, null, 2));
      console.log('Modelo e vocabulário salvos');
    } catch (error) {
      console.error('Erro ao salvar modelo:', error);
    }
  }

  async loadModel() {
    try {
      try {
        this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);

        const vocabData = JSON.parse(await fs.readFile(this.vocabPath, 'utf-8'));
        this.vocabulary = new Map(vocabData.vocabulary);
        this.reverseVocabulary = new Map(vocabData.reverseVocabulary);
        this.maxSequenceLength = vocabData.maxSequenceLength;
        this.vocabSize = vocabData.vocabSize;

        console.log('Modelo carregado do disco');
      } catch {
        console.log('Criando novo modelo...');
        this.model = this.createModel();

        this.buildVocabulary([
          'olá como vai você hoje',
          'o que você quer fazer',
          'vamos criar algo incrível',
          'inteligência artificial é fascinante',
          'machine learning e deep learning',
          'processamento de linguagem natural',
          'este é um exemplo de texto'
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar modelo:', error);
      throw error;
    }
  }

  getInfo() {
    return {
      loaded: this.model !== null,
      vocabularySize: this.vocabulary.size,
      maxSequenceLength: this.maxSequenceLength,
      embeddingDim: this.embeddingDim
    };
  }
}

module.exports = AIModel;