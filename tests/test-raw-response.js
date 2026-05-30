import { createVerdadeAgent } from '../agent.js';
import dotenv from 'dotenv';

dotenv.config();

const agent = createVerdadeAgent();
const userText = "A virginia engravidou do vini junior?";

async function test() {
    console.log(`Testando com a pergunta: "${userText}"`);
    try {
        const resultState = await agent.invoke({
            messages: [
                {
                    role: 'user',
                    content: `Pergunta/Notícia atual do usuário: "${userText}"`
                }
            ]
        }, { configurable: { thread_id: `raw_test_${Date.now()}` } });
        
        console.log('\n=== HISTÓRICO DE MENSAGENS RETORNADO ===');
        resultState.messages.forEach((msg, idx) => {
            console.log(`\nMensagem ${idx}: [Role: ${msg.role || msg.constructor.name}]`);
            console.log('Objeto Completo:', JSON.stringify(msg, null, 2));
        });
        console.log('========================================\n');
    } catch (e) {
        console.error('Erro na execução:', e);
    }
}

test();
