import { createVerdadeAgent } from '../agent.js';
import dotenv from 'dotenv';

dotenv.config();

const agent = createVerdadeAgent();

const pastContext = `Histórico de checagens já enviadas para este mesmo número de telefone:
- Pergunta/Notícia: "https://amp.campograndenews.com.br/brasil/cidades/vigilancia-sanitaria-libera-produtos-da-ype-fabricados-desde-1o-de-abril é verdade?"
  Resposta já enviada anteriormente: "## 🟢 VERDADEIRO

A notícia é verdadeira. A Anvisa realmente liberou a retomada da produção na fábrica da Ypê (em Amparo/SP) e autorizou a comercialização dos produtos fabricados a partir de 1º de abril de 2026.

### O que foi liberado:
- ✅ Detergentes líquidos, lava-roupas líquidos e desinfetantes"

ATENÇÃO: Use esse histórico apenas para saber o que já foi respondido a este usuário, evitando repetir informações idênticas ou contradizer respostas anteriores. Se a pergunta atual for nova, ignore o histórico e realize a checagem normalmente.

`;

const fullPrompt = `${pastContext}Pergunta/Notícia atual do usuário: "E pode beber?"`;

async function test() {
    console.log('Invocando agente com o histórico...');
    try {
        const resultState = await agent.invoke({
            messages: [
                {
                    role: 'user',
                    content: fullPrompt
                }
            ]
        }, { configurable: { thread_id: `test_mem_run_${Date.now()}` } });
        
        const finalMessage = resultState.messages[resultState.messages.length - 1].content;
        console.log('\n--- RESPOSTA BRUTA DO LLM ---');
        console.log(JSON.stringify(finalMessage));
        console.log('-----------------------------\n');
    } catch (e) {
        console.error('Erro:', e);
    }
}

test();
