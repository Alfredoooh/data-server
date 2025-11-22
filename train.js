const AIModel = require('./models/AIModel');
const logger = require('./utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Dados de treinamento em português
const trainingData = [
  // Saudações e conversação
  "olá como você está hoje? espero que esteja bem",
  "bom dia! vamos começar um novo dia cheio de possibilidades",
  "boa tarde, como posso ajudar você hoje?",
  "boa noite, espero que tenha tido um ótimo dia",
  "tudo bem com você? fico feliz em conversar",
  
  // Tecnologia e IA
  "a inteligência artificial está revolucionando o mundo moderno",
  "machine learning é uma área fascinante da ciência da computação",
  "deep learning usa redes neurais profundas para aprender padrões complexos",
  "processamento de linguagem natural permite que máquinas entendam texto",
  "redes neurais artificiais são inspiradas no cérebro humano",
  "algoritmos de aprendizado supervisionado precisam de dados rotulados",
  "o aprendizado não supervisionado encontra padrões sem rótulos",
  "tensorflow e pytorch são frameworks populares para deep learning",
  
  // Ciência e conhecimento
  "a ciência busca compreender os fenômenos naturais através de observação",
  "o método científico envolve hipótese, experimento e análise",
  "a física estuda as leis fundamentais que governam o universo",
  "a matemática é a linguagem da natureza e da ciência",
  "a química explica as transformações da matéria",
  "a biologia investiga os seres vivos e seus processos",
  
  // Motivação e desenvolvimento
  "o aprendizado contínuo é essencial para o crescimento pessoal",
  "persistência e dedicação levam ao sucesso em qualquer área",
  "cada desafio é uma oportunidade de aprender e crescer",
  "a criatividade floresce quando combinamos conhecimentos diferentes",
  "trabalhar em equipe potencializa nossos resultados",
  "estabelecer metas claras ajuda a manter o foco",
  
  // Tecnologia e programação
  "programar é resolver problemas usando lógica e criatividade",
  "javascript é uma linguagem versátil para web e backend",
  "python é excelente para ciência de dados e machine learning",
  "código limpo e bem documentado facilita a manutenção",
  "testes automatizados garantem a qualidade do software",
  "versionamento de código com git é essencial no desenvolvimento",
  
  // Cultura e sociedade
  "a diversidade cultural enriquece nossa compreensão do mundo",
  "a comunicação eficaz é fundamental em todas as relações",
  "respeitar diferentes perspectivas nos torna mais sábios",
  "a educação transforma vidas e sociedades inteiras",
  "inovação surge da combinação de ideias e perspectivas",
  
  // Natureza e meio ambiente
  "a natureza oferece beleza e recursos que devemos preservar",
  "sustentabilidade é pensar nas gerações futuras",
  "a biodiversidade é essencial para o equilíbrio dos ecossistemas",
  "energias renováveis são o futuro da civilização",
  
  // Arte e criatividade
  "a arte expressa emoções e ideias de forma única",
  "música é uma linguagem universal que conecta pessoas",
  "literatura nos transporta para mundos imaginários",
  "criatividade não tem limites quando nos permitimos experimentar",
  
  // Negócios e empreendedorismo
  "empreender requer visão, coragem e adaptabilidade",
  "inovação disruptiva cria novos mercados e oportunidades",
  "entender o cliente é fundamental para o sucesso do negócio",
  "planejamento estratégico guia as decisões empresariais",
  
  // Saúde e bem-estar
  "cuidar da saúde mental é tão importante quanto da física",
  "alimentação equilibrada fornece energia e nutrientes essenciais",
  "exercícios regulares melhoram a qualidade de vida",
  "dormir bem é fundamental para a recuperação do corpo",
  
  // Filosofia e reflexão
  "questionar é o primeiro passo para o conhecimento",
  "cada experiência nos ensina algo valioso",
  "a jornada é tão importante quanto o destino",
  "mudança é a única constante na vida",
  
  // Textos mais longos e complexos
  "o desenvolvimento de inteligência artificial tem sido um dos avanços mais significativos da nossa era. desde os primeiros algoritmos simples até os modelos complexos de deep learning atuais, a evolução tem sido impressionante. hoje, sistemas de IA podem processar linguagem natural, reconhecer imagens, jogar xadrez em nível profissional e até mesmo criar arte. o futuro promete avanços ainda maiores, com aplicações em medicina, educação, transporte e muito mais",
  
  "aprender uma nova habilidade pode parecer desafiador no início, mas com prática consistente e paciência, qualquer pessoa pode dominar conhecimentos complexos. o segredo está em dividir o grande objetivo em pequenas metas alcançáveis, celebrar cada progresso e não desistir diante das dificuldades. cada erro é uma lição valiosa que nos aproxima do sucesso",
  
  "a tecnologia está transformando a forma como vivemos, trabalhamos e nos relacionamos. smartphones conectam bilhões de pessoas ao redor do mundo, permitindo comunicação instantânea e acesso a informação ilimitada. a internet das coisas está tornando nossas casas mais inteligentes, enquanto a automação está revolucionando a indústria. no entanto, é importante usar a tecnologia de forma consciente e equilibrada",
  
  "a colaboração entre pessoas com diferentes habilidades e perspectivas frequentemente leva a soluções inovadoras e criativas. quando trabalhamos juntos, compartilhamos conhecimentos, aprendemos uns com os outros e superamos obstáculos que seriam difíceis de enfrentar sozinhos. equipes diversas trazem ideias únicas e abordagens variadas para resolver problemas complexos"
];

// Função principal de treinamento
async function main() {
  try {
    logger.info('=== Iniciando Script de Treinamento ===');
    
    const model = new AIModel();
    
    // Verificar se existe modelo anterior
    const modelExists = await checkModelExists();
    
    if (modelExists) {
      logger.info('Modelo anterior encontrado. Carregando...');
      await model.loadModel();
      logger.info('Continuando treinamento com modelo existente');
    } else {
      logger.info('Nenhum modelo anterior encontrado. Criando novo modelo...');
      await model.loadModel(); // Isso criará um novo modelo
    }

    // Configurações de treinamento
    const config = {
      epochs: 20,
      batchSize: 16,
      validationSplit: 0.2
    };

    logger.info('Configuração de treinamento:', config);
    logger.info(`Dataset: ${trainingData.length} textos`);

    // Treinar
    const history = await model.train(trainingData, config);

    logger.info('=== Treinamento Concluído ===');
    
    // Teste de geração
    logger.info('\n=== Testes de Geração ===');
    
    const testPrompts = [
      'a inteligência artificial',
      'o aprendizado',
      'tecnologia é',
      'vamos criar'
    ];

    for (const prompt of testPrompts) {
      logger.info(`\nPrompt: "${prompt}"`);
      const generated = await model.generateText(prompt, {
        maxLength: 50,
        temperature: 0.7
      });
      logger.info(`Gerado: "${generated}"\n`);
    }

    logger.info('✅ Script de treinamento finalizado com sucesso!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Erro no treinamento:', error);
    process.exit(1);
  }
}

// Verificar se modelo existe
async function checkModelExists() {
  try {
    const modelPath = path.join(__dirname, 'saved_model', 'model.json');
    await fs.access(modelPath);
    return true;
  } catch {
    return false;
  }
}

// Executar
if (require.main === module) {
  main();
}

module.exports = { trainingData };