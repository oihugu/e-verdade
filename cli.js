import { createVerdadeAgent } from './agent.js';
import dotenv from 'dotenv';

dotenv.config();

const query = process.argv.slice(2).join(' ');

if (!query) {
    console.log('e-verdade Terminal CLI');
    console.log('======================');
    console.log('Uso: node cli.js "<alegação, notícia ou link para checar>"');
    console.log('\nExemplos:');
    console.log('  node cli.js "O lula vai taxar o PIX?"');
    console.log('  node cli.js "https://g1.globo.com/fato-ou-fake/noticia/2024/08/08/e-fato-ou-fake-que-vacinas-causam-x.ghtml"');
    process.exit(0);
}

console.log('======================================================');
console.log('INICIALIZANDO CHECAGEM VIA TERMINAL E-VERDADE');
console.log('======================================================\n');
console.log(`Consulta recebida: "${query}"\n`);

const agent = createVerdadeAgent();

// Regra de Higienização do Contexto:
// Criamos uma nova thread_id limpa a cada execução do terminal
const threadId = `cli_thread_${Date.now()}`;
const config = {
    configurable: {
        thread_id: threadId
    }
};

try {
    console.log('[Orquestrador] Analisando e realizando pesquisas...');
    const resultState = await agent.invoke({
        messages: [
            {
                role: 'user',
                content: query
            }
        ]
    }, config);

    const finalMessage = resultState.messages[resultState.messages.length - 1].content;
    console.log('\n======================================================');
    console.log('VEREDICTO & CHECAGEM DO AGENTE:');
    console.log('======================================================\n');

    let responseText = finalMessage;
    // Formata as tags dos links se estiverem presentes
    if (responseText.includes('[LINKS_START]')) {
        responseText = responseText
            .replace('[LINKS_START]', '\n\n🔗 Links e Fontes de Referência:\n')
            .replace('[LINKS_END]', '')
            .trim();
    }

    // Exibe a resposta final limpando os caracteres markdown do whatsapp para melhor visualização no terminal
    console.log(responseText.replace(/[\*\_]/g, ''));
    console.log('\n======================================================');

} catch (err) {
    console.error('\n[Erro] Ocorreu uma falha ao rodar a checagem:', err.message || err);
}
