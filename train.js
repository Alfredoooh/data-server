// train.js
const brain = require('brain.js');
const fs = require('fs');
const path = require('path');

const modelDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir);

// Peq. dataset de treino — adiciona mais pares conforme quiseres
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
  // adiciona quantos pares quiseres — mais pares = respostas melhores
];

// Cria e treina um LSTM (recurrent)
const net = new brain.recurrent.LSTM({
  inputSize: 20,
  hiddenLayers: [64, 64],
  outputSize: 20
});

console.log('Iniciando treino (poucos iterations — aumenta se quiseres melhor).');
net.train(trainingData, {
  iterations: 2000,
  log: (details) => console.log(details),
  logPeriod: 200,
  learningRate: 0.01,
  errorThresh: 0.011
});

const modelJson = net.toJSON();
fs.writeFileSync(path.join(modelDir, 'chat-model.json'), JSON.stringify(modelJson));
console.log('Treino concluído. Modelo salvo em models/chat-model.json');