const natural = require('natural');
const compromise = require('compromise');

class TextProcessor {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmerPt;
    this.tfidf = new natural.TfIdf();
    this.sentimentAnalyzer = new natural.SentimentAnalyzer('Portuguese', this.stemmer, 'afinn');
  }

  preprocess(text) {
    let processed = text.trim();
    processed = processed.replace(/\s+/g, ' ');
    processed = processed.replace(/https?:\/\/[^\s]+/g, '');
    processed = processed.replace(/[\w.-]+@[\w.-]+\.\w+/g, '');
    return processed;
  }

  postprocess(text) {
    let processed = text.trim();
    processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    
    if (!/[.!?]$/.test(processed)) {
      processed += '.';
    }
    
    processed = processed.replace(/\s+([.,!?;:])/g, '$1');
    processed = processed.replace(/([.,!?;:])([^\s])/g, '$1 $2');
    
    return processed;
  }

  tokenize(text) {
    return this.tokenizer.tokenize(text.toLowerCase());
  }

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

  summarize(text, numSentences = 3) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    if (sentences.length <= numSentences) {
      return text;
    }

    const sentenceScores = sentences.map(sentence => {
      const tokens = this.tokenize(sentence);
      const uniqueTokens = new Set(tokens);

      const lengthScore = Math.min(tokens.length / 20, 1);
      const diversityScore = uniqueTokens.size / tokens.length;

      return {
        sentence,
        score: lengthScore * diversityScore
      };
    });

    const topSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, numSentences)
      .map(item => item.sentence);

    return topSentences.join(' ');
  }

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
}

module.exports = TextProcessor;