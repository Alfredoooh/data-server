const natural = require('natural');
const compromise = require('compromise');

class TextProcessor {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmerPt;
    this.tfidf = new natural.TfIdf();
    this.sentimentAnalyzer = new natural.SentimentAnalyzer('Portuguese', this.stemmer, 'afinn');
  }

  // Pré-processamento
  preprocess(text) {
    // Remover caracteres especiais excessivos
    let processed = text.trim();
    
    // Normalizar espaços
    processed = processed.replace(/\s+/g, ' ');
    
    // Remover URLs
    processed = processed.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remover emails
    processed = processed.replace(/[\w.-]+@[\w.-]+\.\w+/g, '');
    
    return processed;
  }

  // Pós-processamento
  postprocess(text) {
    let processed = text.trim();
    
    // Capitalizar primeira letra
    processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    
    // Garantir ponto final
    if (!/[.!?]$/.test(processed)) {
      processed += '.';
    }
    
    // Remover espaços antes de pontuação
    processed = processed.replace(/\s+([.,!?;:])/g, '$1');
    
    // Adicionar espaço após pontuação se necessário
    processed = processed.replace(/([.,!?;:])([^\s])/g, '$1 $2');
    
    return processed;
  }

  // Tokenização
  tokenize(text) {
    return this.tokenizer.tokenize(text.toLowerCase());
  }

  // Análise de sentimento
  analyzeSentiment(text) {
    const tokens = this.tokenize(text);
    const score = this.sentimentAnalyzer.getSentiment(tokens);
    
    let sentiment;
    if (score > 0.2) sentiment = 'positivo';
    else if (score < -0.2) sentiment = 'negativo';
    else sentiment = 'neutro';
    
    return {
      score: score.toFixed(3),
      sentiment,
      confidence: Math.abs(score).toFixed(3)
    };
  }

  // Extrair entidades
  extractEntities(text) {
    const doc = compromise(text);
    
    return {
      people: doc.people().out('array'),
      places: doc.places().out('array'),
      organizations: doc.organizations().out('array'),
      dates: doc.dates().out('array'),
      topics: doc.topics().out('array')
    };
  }

  // Extrair palavras-chave
  extractKeywords(text, limit = 10) {
    this.tfidf.addDocument(text);
    
    const keywords = [];
    this.tfidf.listTerms(0).slice(0, limit).forEach(item => {
      keywords.push({
        term: item.term,
        tfidf: item.tfidf.toFixed(3)
      });
    });
    
    return keywords;
  }

  // Resumir texto
  summarize(text, numSentences = 3) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    if (sentences.length <= numSentences) {
      return text;
    }

    // Calcular scores para cada sentença
    const sentenceScores = sentences.map(sentence => {
      const tokens = this.tokenize(sentence);
      const uniqueTokens = new Set(tokens);
      
      // Score baseado em comprimento e diversidade
      const lengthScore = Math.min(tokens.length / 20, 1);
      const diversityScore = uniqueTokens.size / tokens.length;
      
      return {
        sentence,
        score: lengthScore * diversityScore
      };
    });

    // Ordenar por score e pegar top N
    const topSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, numSentences)
      .map(item => item.sentence);

    return topSentences.join(' ');
  }

  // Detectar idioma
  detectLanguage(text) {
    const doc = compromise(text);
    
    // Palavras comuns em português
    const ptWords = ['o', 'a', 'os', 'as', 'de', 'da', 'do', 'em', 'para', 'com'];
    const words = this.tokenize(text);
    
    const ptCount = words.filter(w => ptWords.includes(w)).length;
    const ratio = ptCount / words.length;
    
    if (ratio > 0.1) return 'pt';
    return 'en';
  }

  // Corrigir ortografia básica
  spellCheck(text) {
    const doc = compromise(text);
    return doc.normalize().out('text');
  }

  // Contar estatísticas
  getStats(text) {
    const tokens = this.tokenize(text);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const words = text.split(/\s+/).filter(w => w);
    
    return {
      characters: text.length,
      words: words.length,
      sentences: sentences.length,
      uniqueWords: new Set(tokens).size,
      avgWordLength: (text.length / words.length).toFixed(2),
      avgSentenceLength: (words.length / sentences.length).toFixed(2)
    };
  }

  // Extrair n-gramas
  getNgrams(text, n = 2) {
    const tokens = this.tokenize(text);
    const ngrams = [];
    
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }

  // Similaridade entre textos
  similarity(text1, text2) {
    const tokens1 = new Set(this.tokenize(text1));
    const tokens2 = new Set(this.tokenize(text2));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return (intersection.size / union.size).toFixed(3);
  }

  // Remover stop words
  removeStopWords(text) {
    const stopWords = new Set([
      'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'para',
      'com', 'por', 'no', 'na', 'ao', 'à', 'dos', 'das', 'e', 'ou'
    ]);
    
    const tokens = this.tokenize(text);
    const filtered = tokens.filter(token => !stopWords.has(token));
    
    return filtered.join(' ');
  }

  // Stemming
  stem(text) {
    const tokens = this.tokenize(text);
    return tokens.map(token => this.stemmer.stem(token)).join(' ');
  }
}

module.exports = TextProcessor;