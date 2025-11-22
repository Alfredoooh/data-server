// train.js
// Treina um modelo simples com brain.js e salva em models/chat-model.json

const brain = require('brain.js');
const fs = require('fs');
const path = require('path');

const modelDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir);

// Dataset exemplo — expande com mais pares para melhorar
const trainingData = [
  { input: "Olá", output: "Olá! Como posso ajudar?" },
  { input: "Oi", output: "Oi! Em que posso ajudar hoje?" },
  { input: "Quem és tu?", output: "Sou um assistente simples treinado localmente." },
  { input: "Como estás?", output: "Estou bem, obrigado! E tu?" },
  { input: "O que podes fazer?", output: "Posso responder perguntas simples, aprender com exemplos e servir como API." },
  { input: "Qual o teu nome?", output: "Podes chamar-me Assistente Local." },
  { input: "Ajudar com código", output: "Claro — diz-me o que queres que eu gere." },
  { input: "Obrigado", output: "De nada — quando precisares, chama-me!" },
  { input: "Até logo", output: "Até logo! Boa sorte com o projeto." },
  { input: "Como te chamas?", output: "O meu nome é Assistente Local." },
  { input: "Ajuda", output: "Diz-me do que precisas e eu tento ajudar." },
  { input: "Fala em português", output: "Claro — posso responder em português." }
];

// Cria e treina LSTM (recurrent)
const net = new brain.recurrent.LSTM({
  inputSize: 20,
  hiddenLayers: [64, 64],
  outputSize: 20
});

console.log('Iniciando treino (isto pode demorar alguns segundos)...');

net.train(trainingData, {
  iterations: 2000,
  log: true,
  logPeriod: 200,
  learningRate: 0.01,
  errorThresh: 0.011
});

const modelJson = net.toJSON();
fs.writeFileSync(path.join(modelDir, 'chat-model.json'), JSON.stringify(modelJson, null, 2));
console.log('Treino concluído. Modelo salvo em models/chat-model.json');