import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import dotenv from 'dotenv';

dotenv.config();

// Override the prototype method to intercept ALL invokes on any ChatOpenAI instance
const originalInvoke = ChatOpenAI.prototype.invoke;
ChatOpenAI.prototype.invoke = async function(messages, options) {
    console.log('\n--- INTERCEPTADO PELO PROTOTYPE INVOKE ---');
    console.log(`Model: ${this.modelName} | BaseURL: ${this.client?.configuration?.baseURL}`);
    
    // Converte mensagens de ferramenta em texto normal
    const transformed = (Array.isArray(messages) ? messages : [messages]).map(msg => {
        const isToolMessage = msg.role === 'tool' || msg.constructor.name === 'ToolMessage' || msg.type === 'tool';
        const isAIMessage = msg.role === 'assistant' || msg.constructor.name === 'AIMessage' || msg.type === 'ai';

        if (isToolMessage) {
            console.log(`  [Conversor] Transformando ToolMessage (${msg.content.substring(0, 30)}...) para HumanMessage`);
            return new HumanMessage({
                content: `[Resultado da busca/ferramenta]:\n${msg.content}`
            });
        }

        if (isAIMessage) {
            const hasToolCalls = (msg.tool_calls && msg.tool_calls.length > 0) || 
                                 (msg.additional_kwargs && msg.additional_kwargs.tool_calls && msg.additional_kwargs.tool_calls.length > 0);
            if (hasToolCalls) {
                console.log(`  [Conversor] Transformando AIMessage com tool_calls para AIMessage de texto plano`);
                return new AIMessage({
                    content: `Pesquisando no contexto.`
                });
            }
        }
        return msg;
    });

    return originalInvoke.call(this, transformed, options);
};

// Now test with a dummy instance
const model = new ChatOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY
    },
    modelName: "deepseek/deepseek-v4-flash",
    temperature: 0.1
});

async function run() {
    try {
        console.log('Testando chamada simples...');
        const response1 = await model.invoke([
            new HumanMessage("Olá, tudo bem?")
        ]);
        console.log('Response 1:', response1.content);

        console.log('\nTestando chamada com histórico de ferramentas...');
        const response2 = await model.invoke([
            new HumanMessage("A virginia engravidou do vini junior?"),
            new AIMessage({
                content: "",
                additional_kwargs: {
                    tool_calls: [{
                        id: "call_123",
                        type: "function",
                        function: {
                            name: "web_search",
                            arguments: '{"query": "Virginia gravida Vini Junior"}'
                        }
                    }]
                }
            }),
            new ToolMessage({
                content: "Checagem: A assessoria de Virginia Fonseca desmentiu os boatos de gravidez envolvendo o jogador Vini Jr.",
                tool_call_id: "call_123"
            })
        ]);
        console.log('Response 2:', response2.content);
    } catch (e) {
        console.error('Erro no teste:', e);
    }
}

run();
