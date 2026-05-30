import { createVerdadeAgent } from '../agent.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('======================================================');
console.log('INICIALIZANDO TESTE DO AGENTE E-VERDADE');
console.log('======================================================\n');

const agent = createVerdadeAgent();

const mockMemory = [
    {
        query: 'Olha o que recebi no grupo da igreja: a folha do mamão cura a dengue em 24 horas! Compartilhem para salvar vidas!',
        summary: 'Olá, Dona Maria. Essa notícia é Falsa. Checagens oficiais de saúde mostram que não há qualquer comprovação científica de que o chá ou folha do mamão cure a dengue em 24 horas.'
    }
];

const testCases = [
    {
        name: 'Maria (70 anos) - Tom acolhedor e Roteiro de Áudio',
        query: 'Olha o que recebi no grupo da igreja: a folha do mamão cura a dengue em 24 horas! Compartilhem para salvar vidas!',
        isAudio: true
    },
    {
        name: 'João (45 anos) - Tom neutro e factível',
        query: 'É verdade que o governo vai criar um novo imposto sobre transações PIX a partir do próximo mês?',
        isAudio: false
    },
    {
        name: 'Enzo (20 anos) - Tom super curto e direto',
        query: 'vi um meme dizendo que a terra é plana e o governo esconde a verdade kkkkk procede?',
        isAudio: false
    },
    {
        name: 'Maria (70 anos) - Checagem de Memória de Envio Anterior',
        query: 'Filho, você já me mandou informações sobre a folha do mamão cura dengue?',
        isAudio: true,
        useMockMemory: true
    }
];

async function runTests() {
    for (const tc of testCases) {
        console.log(`\n------------------------------------------------------`);
        console.log(`EXECUTANDO CASO DE TESTE: ${tc.name}`);
        console.log(`Mensagem do Usuário: "${tc.query}"`);
        console.log(`------------------------------------------------------`);

        // Carrega a simulação da memória se especificado
        let pastContext = "";
        if (tc.useMockMemory) {
            pastContext = "Histórico de checagens já enviadas para este mesmo número de telefone:\n" + 
                mockMemory.map(v => 
                    `- Pergunta/Notícia: "${v.query}"\n  Resposta já enviada anteriormente: "${v.summary}"`
                ).join("\n") + "\n\nATENÇÃO: Use esse histórico apenas para saber o que já foi respondido a este usuário, evitando repetir informações idênticas ou contradizer respostas anteriores. Se a pergunta atual for nova, ignore o histórico e realize a checagem normalmente.\n\n";
        }

        const fullPrompt = `${pastContext}Pergunta/Notícia atual do usuário: "${tc.query}"`;

        const threadId = `test_thread_${Date.now()}`;
        const config = {
            configurable: {
                thread_id: threadId
            }
        };

        try {
            console.log('[Agente] Processando...');
            const resultState = await agent.invoke({
                messages: [
                    {
                        role: 'user',
                        content: fullPrompt
                    }
                ]
            }, config);

            const finalMessage = resultState.messages[resultState.messages.length - 1].content;
            console.log('\n[Agente] Resposta do Agente:\n');

            let replyText = finalMessage;
            let linksText = '';

            // Se for áudio, extrai os links para simular a separação
            if (tc.isAudio) {
                if (replyText.includes('[LINKS_START]')) {
                    const start = replyText.indexOf('[LINKS_START]');
                    const end = replyText.indexOf('[LINKS_END]');
                    if (end > start) {
                        linksText = replyText.substring(start + '[LINKS_START]'.length, end).trim();
                        replyText = replyText.substring(0, start).trim();
                    }
                }
                console.log('🎙️ ROTEIRO PARA ÁUDIO (Sem links/caracteres estranhos):');
                console.log(replyText.replace(/[\*\_\[\]]/g, '').trim());
                if (linksText) {
                    console.log('\n🔗 TEXTO DE LINKS ENVIADO SEGUIDAMENTE:');
                    console.log(linksText);
                }
            } else {
                // Se for texto normal, formata as tags para exibição amigável
                if (replyText.includes('[LINKS_START]')) {
                    replyText = replyText
                        .replace('[LINKS_START]', '\n\n🔗 *Links e Fontes de Referência:*\n')
                        .replace('[LINKS_END]', '')
                        .trim();
                }
                console.log(replyText);
            }
        } catch (err) {
            console.error('Erro ao executar teste:', err);
        }
    }
}

// Verifica se há chave de API antes de rodar os testes
if (!process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.log('⚠️ AVISO: Configure OPENAI_API_KEY, DEEPSEEK_API_KEY ou OPENROUTER_API_KEY no arquivo .env para rodar os testes com LLM.');
} else {
    runTests();
}
