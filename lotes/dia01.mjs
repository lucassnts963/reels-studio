// lotes/dia01.mjs — Dia 1 do calendário de Shorts (24 quizzes, 1 por hora).
// Rode: node lotes/dia01.mjs  → grava content/q001-*.json ... q024-*.json
// Fatos escolhidos por serem clássicos, estáveis e verificáveis na fonte citada.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TEMA_TAGS = {
  'História': 'historia da computacao,retro,computadores antigos',
  'Internet': 'internet,web,navegador',
  'Atalhos': 'atalhos,produtividade,teclado',
  'Excel': 'excel,planilhas,atalhos excel,dicas de excel',
  'Segurança': 'seguranca digital,senhas,privacidade',
  'IA': 'inteligencia artificial,ia,chatgpt',
  'Curiosidades': 'curiosidades tech,fatos,gadgets',
};

// q(slug, tema, hook1, hookSub, pergunta(linhas |), [A,B,C], correta, reveal, fonte, tituloYT)
const q = (slug, tema, hook1, hookSub, question, opts, correta, reveal, fonte, titulo) =>
  ({ slug, tema, hook1, hookSub, question, opts, correta, reveal, fonte, titulo });

const QUIZZES = [
  q('q001-mouse-madeira', 'História', 'VOCÊ SABIA?', 'Quiz de história tech',
    'De que material era|o primeiro mouse|da história?',
    ['Plástico', 'Madeira', 'Alumínio'], 'B',
    'Madeira! Criado em 1964.',
    'https://en.wikipedia.org/wiki/Computer_mouse',
    'De que material era o PRIMEIRO mouse da história? 🖱️ #Shorts'),

  q('q002-erro-404', 'Internet', 'TESTE RÁPIDO', 'Você vê isso todo dia',
    'O que significa|o famoso erro 404?',
    ['Página não existe', 'Site fora do ar', 'Internet caiu'], 'A',
    '404 = página não encontrada.',
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404',
    'O que significa o erro 404? 99% erram! 🌐 #Shorts'),

  q('q003-ctrl-z', 'Atalhos', 'QUIZ TECH', 'Nível: iniciante',
    'Qual atalho desfaz|o último erro|no computador?',
    ['Ctrl + X', 'Ctrl + V', 'Ctrl + Z'], 'C',
    'Ctrl+Z desfaz quase tudo!',
    'https://support.microsoft.com/pt-br/windows/atalhos-de-teclado-no-windows-dcc61a57-8ff0-cffe-9796-cb9706c75eec',
    'O atalho que SALVA seu trabalho todo dia ⌨️ #Shorts'),

  q('q004-peso-eniac', 'História', 'DUVIDO ACERTAR', 'Quiz de história tech',
    'Quanto pesava o|ENIAC, computador|de 1946?',
    ['300 kg', '2 toneladas', '27 toneladas'], 'C',
    '27 toneladas e 167 m²!',
    'https://en.wikipedia.org/wiki/ENIAC',
    'Quanto pesava um computador de 1946? 😱 #Shorts'),

  q('q005-www-criador', 'Internet', 'VOCÊ SABIA?', 'Quiz de internet',
    'Quem criou a|World Wide Web|em 1989?',
    ['Bill Gates', 'Steve Jobs', 'Tim Berners-Lee'], 'C',
    'Tim Berners-Lee, no CERN.',
    'https://en.wikipedia.org/wiki/World_Wide_Web',
    'Quem criou a WEB? (não é quem você pensa) 🌍 #Shorts'),

  q('q006-primeiro-video-youtube', 'Curiosidades', 'TESTE RÁPIDO', 'Quiz de curiosidades',
    'Qual foi o 1º vídeo|do YouTube, em 2005?',
    ['Um clipe musical', 'Me at the zoo', 'Um vídeo de gato'], 'B',
    "'Me at the zoo', 19 segundos.",
    'https://en.wikipedia.org/wiki/Me_at_the_zoo',
    'O PRIMEIRO vídeo do YouTube foi… 🎬 #Shorts'),

  q('q007-teclado-qwerty', 'Curiosidades', 'VOCÊ SABIA?', 'Olha pro seu teclado',
    'Por que o teclado|é QWERTY e não|ABCDEF?',
    ['Por estética', 'Evitar travamento', 'Foi sorteio'], 'B',
    'Evitava travar as hastes!',
    'https://en.wikipedia.org/wiki/QWERTY',
    'Por que o teclado NÃO é em ordem alfabética? ⌨️ #Shorts'),

  q('q008-primeiro-bug', 'História', 'QUIZ TECH', 'Essa é clássica',
    "O 1º 'bug' de|computador foi|literalmente...",
    ['Uma mariposa', 'Um rato', 'Uma barata'], 'A',
    'Mariposa presa no relé, 1947.',
    'https://en.wikipedia.org/wiki/Software_bug',
    'O primeiro BUG da história foi um inseto DE VERDADE 🦋 #Shorts'),

  q('q009-bluetooth-rei', 'Curiosidades', 'DUVIDO ACERTAR', 'Quiz de curiosidades',
    'Bluetooth vem do|nome de um...',
    ['Rei viking', 'Engenheiro', 'Tipo de dente'], 'A',
    "Rei Harald 'Dente Azul'!",
    'https://en.wikipedia.org/wiki/Bluetooth#Etymology',
    'Bluetooth tem nome de REI VIKING?! 👑 #Shorts'),

  q('q010-wifi-significado', 'Internet', 'VOCÊ SABIA?', '99% respondem errado',
    "Wi-Fi significa|'Wireless Fidelity'?",
    ['Não, é marketing', 'Sim', 'Só nos EUA'], 'A',
    'Não significa nada! É marca.',
    'https://en.wikipedia.org/wiki/Wi-Fi#Etymology_and_terminology',
    'Wi-Fi NÃO significa o que você pensa 📶 #Shorts'),

  q('q011-linhas-excel', 'Excel', 'QUIZ EXCEL', 'Só os raiz sabem',
    'Quantas linhas tem|uma planilha|do Excel?',
    ['65.536', '1.048.576', 'Infinitas'], 'B',
    '2^20 = 1.048.576 linhas.',
    'https://support.microsoft.com/pt-br/office/especifica%C3%A7%C3%B5es-e-limites-do-excel-1672b34d-7043-467e-8e27-269d656771c3',
    'Quantas linhas cabem no Excel? 📊 #Shorts'),

  q('q012-ctrl-e-excel', 'Excel', 'TESTE RÁPIDO', 'Atalho subestimado',
    'O que faz Ctrl+E|no Excel?',
    ['Exclui a linha', 'Preenche sozinho', 'Exporta PDF'], 'B',
    'Preenchimento Relâmpago!',
    'https://support.microsoft.com/pt-br/office/usar-o-preenchimento-rel%C3%A2mpago-no-excel-3f9bcf1e-db93-4890-94a0-1578341f73f7',
    'O atalho de Excel que parece MÁGICA ⚡ #Shorts'),

  q('q013-primeiro-email', 'História', 'VOCÊ SABIA?', 'Quiz de história tech',
    'Quem escolheu o @|para o e-mail?',
    ['Steve Wozniak', 'A IBM', 'Ray Tomlinson'], 'C',
    'Tomlinson, em 1971.',
    'https://en.wikipedia.org/wiki/Ray_Tomlinson',
    'Quem inventou o @ do e-mail? 📧 #Shorts'),

  q('q014-captcha', 'Segurança', 'QUIZ TECH', 'Você faz isso sempre',
    'O CAPTCHA serve|para provar que|você...',
    ['Não é um robô', 'Sabe digitar', 'Tem paciência'], 'A',
    'Teste de Turing automatizado.',
    'https://en.wikipedia.org/wiki/CAPTCHA',
    'Pra que serve o CAPTCHA de verdade? 🤖 #Shorts'),

  q('q015-android-doces', 'Curiosidades', 'TESTE RÁPIDO', 'Quiz de curiosidades',
    'As versões antigas|do Android tinham|nome de...',
    ['Doces', 'Planetas', 'Animais'], 'A',
    'KitKat, Oreo, Pie… doçura!',
    'https://en.wikipedia.org/wiki/Android_version_history',
    'O segredo dos nomes do Android 🍭 #Shorts'),

  q('q016-google-backrub', 'Curiosidades', 'DUVIDO ACERTAR', 'Quiz de curiosidades',
    'Qual era o 1º nome|do Google?',
    ['SearchIt', 'WebFinder', 'BackRub'], 'C',
    "BackRub — 'massagem'! (1996)",
    'https://en.wikipedia.org/wiki/History_of_Google',
    'O Google já se chamou… BACKRUB?! 🔍 #Shorts'),

  q('q017-primeiro-sms', 'História', 'VOCÊ SABIA?', 'Quiz de história tech',
    'O que dizia o 1º|SMS da história?',
    ['Feliz Natal', 'Olá, mundo!', 'Teste 123'], 'A',
    "'Merry Christmas', em 1992.",
    'https://en.wikipedia.org/wiki/SMS',
    'O primeiro SMS da história dizia… 💬 #Shorts'),

  q('q018-emoji-japones', 'Curiosidades', 'QUIZ TECH', 'Você usa todo dia',
    'A palavra emoji|vem de que idioma?',
    ['Inglês', 'Japonês', 'Coreano'], 'B',
    'E (imagem) + moji (caractere).',
    'https://en.wikipedia.org/wiki/Emoji',
    'De onde vem a palavra EMOJI? 😀 #Shorts'),

  q('q019-senha-mais-usada', 'Segurança', 'TESTE RÁPIDO', 'Espero que não seja a sua',
    'Qual é a senha mais|usada no mundo?',
    ['senha123', 'qwerty', '123456'], 'C',
    '123456 — milhões usam. Troca!',
    'https://en.wikipedia.org/wiki/List_of_the_most_common_passwords',
    'A senha mais usada do MUNDO (troca agora) 🔒 #Shorts'),

  q('q020-html-linguagem', 'Internet', 'POLÊMICA TECH', 'Devs vão discutir',
    'HTML é linguagem|de programação?',
    ['Sim', 'Não, de marcação', 'Só o HTML5'], 'B',
    'Markup: estrutura, não lógica.',
    'https://developer.mozilla.org/en-US/docs/Web/HTML',
    'HTML é linguagem de programação? 🧑‍💻 #Shorts'),

  q('q021-iphone-appstore', 'Curiosidades', 'VOCÊ SABIA?', 'Quiz de curiosidades',
    'O 1º iPhone (2007)|tinha App Store?',
    ['Sim, claro', 'Não!', 'Só nos EUA'], 'B',
    'App Store só chegou em 2008.',
    'https://en.wikipedia.org/wiki/IPhone_(1st_generation)',
    'O primeiro iPhone NÃO tinha isso 📱 #Shorts'),

  q('q022-byte-bits', 'História', 'QUIZ TECH', 'Básico que muita gente erra',
    'Um byte tem|quantos bits?',
    ['4', '16', '8'], 'C',
    '8 bits = 1 byte. Sempre.',
    'https://en.wikipedia.org/wiki/Byte',
    'Quantos bits tem 1 byte? Básico que muita gente erra 💾 #Shorts'),

  q('q023-chatgpt-100mi', 'IA', 'QUIZ DE IA', 'Recorde histórico',
    'ChatGPT levou quanto|tempo p/ 100 milhões|de usuários?',
    ['2 meses', '1 ano', '3 anos'], 'A',
    '2 meses — recorde da época.',
    'https://en.wikipedia.org/wiki/ChatGPT',
    'A velocidade INSANA do ChatGPT 🤯 #Shorts'),

  q('q024-apple-1-preco', 'Curiosidades', 'DUVIDO ACERTAR', 'Preço no mínimo curioso',
    'Por quanto era|vendido o Apple-1|em 1976?',
    ['US$ 666,66', 'US$ 100', 'US$ 9.999'], 'A',
    'US$ 666,66 — Woz gostava do nº.',
    'https://en.wikipedia.org/wiki/Apple_I',
    'O preço BIZARRO do primeiro computador da Apple 🍎 #Shorts'),
];

let n = 0;
for (const [i, z] of QUIZZES.entries()) {
  const letters = ['A', 'B', 'C'];
  const cfg = {
    formato: 'quiz',
    tag: 'Quiz · ' + z.tema,
    hook1: z.hook1,
    hookSub: z.hookSub,
    question: z.question.split('|').map(s => s.trim()).join('\n'),
    options: z.opts.map((text, k) => ({ text, correct: letters[k] === z.correta })),
    reveal: z.reveal,
    ctaTitle: 'Acertou? Comenta aí.',
    handleSub: 'tech · produtividade · IA',
    fonte: z.fonte,
    dificuldade: '',
    agenda: { dia: 1, hora: i },
    yt: {
      titulo: z.titulo,
      descricao: `Quiz rápido de tecnologia: ${z.question.split('|').map(s => s.trim()).join(' ')} ` +
        `Comenta se acertou e manda pra aquele amigo que se acha expert! 👇\n\n` +
        `#quiz #tecnologia #curiosidades`,
      tags: 'quiz,tecnologia,curiosidades,você sabia,quiz de tecnologia,shorts,' + (TEMA_TAGS[z.tema] || ''),
    },
  };
  fs.writeFileSync(path.join(ROOT, 'content', z.slug + '.json'), JSON.stringify(cfg, null, 2) + '\n');
  n++;
}
console.log(`✓ ${n} quizzes do dia 1 gravados em content/`);
