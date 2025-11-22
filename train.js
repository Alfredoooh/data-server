const AIModel = require('./models/AIModel');
const fs = require('fs').promises;
const path = require('path');

const trainingData = [
  "olá como você está hoje? espero que esteja bem",
  "bom dia! vamos começar um novo dia cheio de possibilidades",
  "boa tarde, como posso ajudar você hoje?",
  "boa noite, espero que tenha tido um ótimo dia",
  "tudo bem com você? fico feliz em conversar",
  "a inteligência artificial está revolucionando o mundo moderno",
  "machine learning é uma área fascinante da ciência da computação",
  "deep learning usa redes neurais profundas para aprender padrões complexos",
  "processamento de linguagem natural permite que máquinas entendam texto",
  "redes neurais artificiais são inspiradas no cérebro humano",
  "algoritmos de aprendizado supervisionado precisam de dados rotulados",
  "o aprendizado não supervisionado encontra padrões sem rótulos",
  "tensorflow e pytorch são frameworks populares para deep learning",
  "a ciência busca compreender os fenômenos naturais através de observação",
  "o método científico envolve hipótese, experimento e análise",
  "a física estuda as leis fundamentais que governam o universo",
  "a matemática é a linguagem da natureza e da ciência",
  "a química explica as transformações da matéria",
  "a biologia investiga os seres vivos e seus processos",
  "o aprendizado contínuo é essencial para o crescimento pessoal",
  "persistência e dedicação levam ao sucesso em qualquer área",
  "cada desafio é uma oportunidade de aprender e crescer",
  "a criatividade floresce quando combinamos conhecimentos diferentes",
  "trabalhar em equipe potencializa nossos resultados",
  "estabelecer metas claras ajuda a manter o foco",
  "programar é resolver problemas usando lógica e criatividade",
  "javascript é uma linguagem versátil para web e backend",
  "python é excelente para ciência de dados e machine learning",
  "código limpo e bem documentado facilita a manutenção",
  "testes automatizados garantem a qualidade do software",
  "versionamento de código com git é essencial no desenvolvimento"
];

async function main() {
  try {
    console.log('=== Iniciando Script de Treinamento ===');

    const model = new AIModel();

    const modelExists = await checkModelExists();

    if (modelExists) {
      console.log('Modelo anterior encontrado. Carregando...');
      await model.loadModel();
      console.log('Continuando treinamento com modelo existente');
    } else {
      console.log('Nenhum modelo anterior encontrado. Criando novo modelo...');
      await model.loadModel();
    }

    const config = {
      epochs: 20,
      batchSize: 16,
      validationSplit: 0.2
    };

    console.log('Configuração de treinamento:', config);
    console.log(`Dataset: ${trainingData.length} textos`);

    const history = await model.train(trainingData, config);

    console.log('=== Treinamento Concluído ===');

    console.log('\n=== Testes de Geração ===');

    const testPrompts = [
      'a inteligência artificial',
      'o aprendizado',
      'tecnologia é',
      'vamos criar'
    ];

    for (const prompt of testPrompts) {
      console.log(`\nPrompt: "${prompt}"`);
      const generated = await model.generateText(prompt, {
        maxLength: 50,
        temperature: 0.7
      });
      console.log(`Gerado: "${generated}"\n`);
    }

    console.log('✅ Script de treinamento finalizado com sucesso!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro no treinamento:', error);
    process.exit(1);
  }
}

async function checkModelExists() {
  try {
    const modelPath = path.join(__dirname, 'saved_model', 'model.json');
    await fs.access(modelPath);
    return true;
  } catch {
    return false;
  }
}

if (require.main === module) {
  main();
}

module.exports = { trainingData };