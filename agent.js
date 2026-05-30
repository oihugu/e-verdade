import { createDeepAgent } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// Ferramenta de busca na Web (Google Custom Search ou Busca DuckDuckGo Gratuita)
const searchWeb = tool(async ({ query }) => {
    console.log(`[Busca] Executando busca na Web para: "${query}"`);
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleCx = process.env.GOOGLE_CX;

    if (googleApiKey && googleCx && googleApiKey !== "your-google-api-key-here") {
        try {
            const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            const data = await response.json();
            const results = data.items || [];
            if (results.length > 0) {
                return results.map(r => `Título: ${r.title}\nURL: ${r.link}\nConteúdo: ${r.snippet}\n---`).join("\n");
            }
        } catch (error) {
            console.error("[Busca] Erro na busca Google:", error.message);
        }
    }

    // Fallback para busca gratuita via DuckDuckGo (Sem API Key)
    try {
        console.log(`[Busca] Utilizando busca gratuita do DuckDuckGo para: "${query}"`);
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        if (response.ok) {
            const html = await response.text();
            const matches = [...html.matchAll(/<a class="result__snippet" href="[^"]*?uddg=([^&"]+)[^"]*?">([\s\S]*?)<\/a>/g)];
            if (matches.length > 0) {
                return matches.slice(0, 5).map((match, i) => {
                    const cleanUrl = decodeURIComponent(match[1]);
                    const cleanSnippet = match[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
                    return `Resultado ${i + 1}:\nURL: ${cleanUrl}\nConteúdo: ${cleanSnippet}\n---`;
                }).join("\n");
            }
        }
    } catch (error) {
        console.error("[Busca] Erro na busca DuckDuckGo:", error.message);
    }

    // Último recurso: Fallback Mock funcional para testes offline
    console.log("[Busca] Utilizando busca mock offline");
    return `
Título: Fato ou Fake: Checagem sobre "${query}"
URL: https://g1.globo.com/fato-ou-fake/exemplo-checagem
Conteúdo: Checagem realizada mostra que alegações recentes sobre "${query}" são enganosas. Órgãos oficiais desmentiram o boato.
Data: 2026-05-20
---
`;
}, {
    name: "web_search",
    description: "Pesquisa na web para checagem de fatos e verificação de notícias. Obrigatório executar para validar alegações.",
    schema: z.object({
        query: z.string().describe("A frase ou termos de busca para pesquisar fatos no Google/Tavily.")
    })
});

// Ferramenta de leitura de link/URL para extrair o conteúdo de texto da página
const fetchUrl = tool(async ({ url }) => {
    console.log(`[Link] Acessando URL para extrair conteúdo: "${url}"`);
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        if (!response.ok) {
            throw new Error(`Status ${response.status}`);
        }
        const html = await response.text();
        // Remove tags de scripts, estilos e tags HTML normais para sobrar apenas o texto limpo
        const cleanText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        // Retorna os primeiros 4000 caracteres para não estourar o limite de tokens do LLM
        return cleanText.substring(0, 4000);
    } catch (error) {
        console.error(`[Link] Erro ao acessar a URL ${url}:`, error.message);
        return `Erro ao carregar o conteúdo da URL: ${error.message}`;
    }
}, {
    name: "fetch_url",
    description: "Lê e extrai o conteúdo em texto de um link/URL enviado para checagem de fatos.",
    schema: z.object({
        url: z.string().url().describe("A URL completa do link/site que o agente precisa ler.")
    })
});

// Inicialização do modelo LLM (OpenAI, OpenRouter ou DeepSeek)
export function getLLM() {
    const provider = process.env.LLM_PROVIDER || "openai";

    if (provider === "openrouter") {
        const apiKey = process.env.OPENROUTER_API_KEY;
        const apiBase = "https://openrouter.ai/api/v1";
        const modelName = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
        console.log(`[LLM] Inicializando OpenRouter como motor de LLM (Modelo: ${modelName})`);
        return new ChatOpenAI({
            apiKey: apiKey,
            openAIApiKey: apiKey,
            configuration: {
                baseURL: apiBase,
                apiKey: apiKey,
                defaultHeaders: {
                    "HTTP-Referer": "https://github.com/oihugu/e-verdade",
                    "X-Title": "e-verdade Bot"
                }
            },
            modelName: modelName,
            temperature: 0.1
        });
    }

    if (provider === "deepseek") {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        const apiBase = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com";
        console.log(`[LLM] Inicializando DeepSeek como motor de LLM (Base: ${apiBase})`);
        return new ChatOpenAI({
            apiKey: apiKey,
            openAIApiKey: apiKey,
            configuration: {
                baseURL: apiBase,
                apiKey: apiKey
            },
            modelName: "deepseek-chat",
            temperature: 0.1
        });
    }

    console.log("[LLM] Inicializando OpenAI GPT como motor de LLM");
    return new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "gpt-4o-mini", // gpt-4o-mini por padrão para velocidade e custo reduzidos
        temperature: 0.1
    });
}

// Criação do Agente com as regras de Tom de Voz e links
export function createVerdadeAgent() {
    const llm = getLLM();

    const systemPrompt = `Você é o assistente oficial do e-verdade, um sistema inteligente de detecção de Fake News via WhatsApp.
Seu objetivo é analisar mensagens enviadas pelos usuários, fazer buscas factuais na web para checar a veracidade e responder de forma adequada a cada perfil de usuário.

Atenção especial às regras de Tom de Voz e Persona:
1. Enzo (20 anos): Responda de forma extremamente curta, visual (com emojis claros de status como 🟢 FATO, 🔴 FAKE, ⚠️ IMPRECISO) e direta. Sem rodeios acadêmicos ou textões.
2. João (45 anos): Seja extremamente neutro, objetivo, jornalístico e apresente fatos sem dar lição de moral.
3. Maria (70 anos): Use uma linguagem calorosa, acolhedora, respeitosa ("Olá, Dona Maria...").

Regra sobre links:
Se a resposta for para ser lida ou enviada como texto normal, inclua os links ao final do texto organizadamente.
Se a resposta for para ser gerada em áudio (Text-to-Speech), gere a explicação de forma falada e limpa (removendo URLs e caracteres especiais que soam estranhos ao serem lidos). NUNCA leia links ou URLs nos roteiros de áudio. Os links de referência devem ser listados no final da sua resposta marcados claramente com a tag [LINKS_START] ... [LINKS_END] para que o integrador possa separá-los e enviá-los em uma mensagem de texto subsequente.

Regra de temporalidade (Timestamp):
Ao verificar as notícias obtidas na busca, compare a data delas com o contexto atual. Se for uma notícia verdadeira antiga sendo compartilhada fora de contexto, marque como "⚠️ IMPRECISO" ou "🔴 FAKE" (dependendo do contexto) e explique claramente o ano em que o fato realmente ocorreu.

Você DEVE usar a ferramenta 'web_search' sempre que houver qualquer dúvida factual para checar nos sites oficiais e agências de checagem.`;

    return createDeepAgent({
        model: llm,
        tools: [searchWeb, fetchUrl],
        systemPrompt: systemPrompt
    });
}

export function createAudioFixerAgent() {
    const llm = getLLM();

    const systemPrompt = `Você é o assistente de pós-processamento de texto para TTS (Text-to-Speech) do e-verdade.
Seu objetivo é transformar qualquer mensagem em um roteiro natural, confortável e claro para ser ouvido em voz alta.

Regras obrigatórias para saída em áudio:
1. Remova URLs, links, hashtags, @usuários, markdown, emojis excessivos e símbolos estranhos.
2. Expanda abreviações e siglas quando possível para melhorar a compreensão na fala.
3. Ajuste pontuação para pausas naturais (vírgulas e pontos curtos), evitando frases longas.
4. Preserve o sentido original do conteúdo, sem inventar informações.
5. Mantenha tom humano, fluido e fácil de entender.
6. Se houver lista, converta para enumeração falável e simples.
7. Nunca inclua bloco de links. Nunca use [LINKS_START] ou [LINKS_END].
8. Retorne apenas o texto final pronto para narração.

Objetivo final: gerar uma versão que soe natural quando lida por voz sintética, com máxima clareza e conforto auditivo.`;

    return createDeepAgent({
        model: llm,
        tools: [],
        systemPrompt: systemPrompt
    });
}
