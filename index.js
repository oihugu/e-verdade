import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createVerdadeAgent } from './agent.js';

dotenv.config();

console.log('Inicializando e-verdade Bot com Deep Agents...');

// Whitelist para responder apenas a números autorizados (ex: o do usuário de teste)
const whitelist = ['5511972747114', '551172747114', '195206381084836', '195206381084836@lid'];

// Pasta para guardar o histórico de checagens dos usuários
const MEMORY_DIR = path.resolve('./memory');
if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR);
}

// Função para ler o histórico de mensagens enviadas para o número
function readUserMemory(senderNumber) {
    const filePath = path.join(MEMORY_DIR, `${senderNumber}.json`);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`[Memória] Erro ao ler arquivo de memória de ${senderNumber}:`, e.message);
        return [];
    }
}

// Função para salvar uma nova checagem na memória do número
function saveUserMemory(senderNumber, record) {
    const filePath = path.join(MEMORY_DIR, `${senderNumber}.json`);
    const history = readUserMemory(senderNumber);
    
    // Limita o histórico guardado aos últimos 10 itens para evitar estourar o contexto do LLM
    history.push(record);
    if (history.length > 10) {
        history.shift();
    }
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');
        console.log(`[Memória] Nova checagem salva para ${senderNumber}. Total de registros: ${history.length}`);
    } catch (e) {
        console.error(`[Memória] Erro ao salvar arquivo de memória de ${senderNumber}:`, e.message);
    }
}

// Inicializa o agente da checagem de fatos
const agent = createVerdadeAgent();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n======================================================');
    console.log('ESCANEIE O QR CODE ABAIXO PARA CONECTAR:');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n======================================================');
    console.log('Bot e-verdade está pronto!');
    console.log('======================================================\n');
});

// Função para transcrever mensagens de voz usando a API do Whisper (OpenAI)
async function transcribeAudio(media) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
        console.log('[Whisper] Sem chave OpenAI configurada. Usando transcrição mock.');
        return 'Mock: Vacina da gripe causa efeitos graves?';
    }

    try {
        console.log('[Whisper] Enviando áudio para transcrição...');
        const fileBlob = new Blob([Buffer.from(media.data, 'base64')], { type: media.mimetype });
        const formData = new FormData();
        formData.append('file', fileBlob, 'audio.ogg');
        formData.append('model', 'whisper-1');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Erro API Whisper: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        console.log(`[Whisper] Transcrição concluída: "${data.text}"`);
        return data.text;
    } catch (error) {
        console.error('[Whisper] Erro ao transcrever áudio:', error.message);
        return null;
    }
}

// Função para sintetizar áudio usando ElevenLabs
async function textToSpeech(text) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel

    if (!apiKey || apiKey === 'your-elevenlabs-api-key-here') {
        console.log('[TTS] Sem chave ElevenLabs configurada. Retornando null.');
        return null;
    }

    try {
        console.log('[TTS] Sintetizando áudio com ElevenLabs...');
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Erro ElevenLabs: ${response.status} - ${errText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const tempPath = path.resolve(`./temp_tts_${Date.now()}.ogg`);
        fs.writeFileSync(tempPath, buffer);
        console.log(`[TTS] Áudio salvo temporariamente em: ${tempPath}`);
        return tempPath;
    } catch (error) {
        console.error('[TTS] Erro na síntese de voz:', error.message);
        return null;
    }
}

client.on('message', async (msg) => {
    const senderNumber = msg.from.split('@')[0];
    if (!whitelist.includes(senderNumber) && !whitelist.includes(msg.from)) {
        // Ignora mensagens de números fora da whitelist
        return;
    }

    console.log(`\n[Mensagem] Recebida de [${msg.from}]. Tipo: ${msg.type}`);

    let userText = '';
    let isAudio = false;

    // Trata áudios recebidos
    if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'voice')) {
        isAudio = true;
        try {
            const media = await msg.downloadMedia();
            userText = await transcribeAudio(media);
        } catch (err) {
            console.error('[Mensagem] Erro ao baixar ou processar áudio:', err.message);
            await msg.reply('⚠️ Desculpe, não consegui processar seu áudio.');
            return;
        }
    } else {
        userText = msg.body;
        // Permite forçar resposta em áudio se conter a flag !audio na mensagem de texto (útil para testes)
        if (userText.includes('!audio')) {
            isAudio = true;
            userText = userText.replace('!audio', '').trim();
        }
    }

    if (!userText || userText.trim().length === 0) {
        return;
    }

    console.log(`[Mensagem] Texto para processar: "${userText}"`);

    // Regra de Higienização do Contexto:
    // Para evitar contaminação e viés de checagens anteriores, criamos uma nova sessão (thread_id)
    // limpa para cada checagem factual executada.
    const threadId = `session_${senderNumber}_${Date.now()}`;
    const config = {
        configurable: {
            thread_id: threadId
        }
    };

    console.log(`[Orquestrador] Iniciando checagem. Thread ID: ${threadId}`);
    try {
        // Carrega o histórico enviado anteriormente para injetar no contexto
        const pastVerifications = readUserMemory(senderNumber);
        let pastContext = "";
        if (pastVerifications.length > 0) {
            pastContext = "Histórico de checagens já enviadas para este mesmo número de telefone:\n" + 
                pastVerifications.map(v => 
                    `- Pergunta/Notícia: "${v.query}"\n  Resposta já enviada anteriormente: "${v.summary}"`
                ).join("\n") + "\n\nATENÇÃO: Use esse histórico apenas para saber o que já foi respondido a este usuário, evitando repetir informações idênticas ou contradizer respostas anteriores. Se a pergunta atual for nova, ignore o histórico e realize a checagem normalmente.\n\n";
        }

        const fullPrompt = `${pastContext}Pergunta/Notícia atual do usuário: "${userText}"`;

        const resultState = await agent.invoke({
            messages: [
                {
                    role: "user",
                    content: fullPrompt
                }
            ]
        }, config);

        // A última mensagem do estado retornado é a resposta final do LLM
        const finalMessage = resultState.messages[resultState.messages.length - 1].content;
        console.log(`[Orquestrador] Resposta final gerada.`);

        // Salva a checagem atual no histórico deste usuário
        const newRecord = {
            date: new Date().toISOString().split('T')[0],
            query: userText,
            summary: finalMessage.replace(/[\*\_\[\]]/g, '').substring(0, 300).trim() + "..."
        };
        saveUserMemory(senderNumber, newRecord);

        // Processa separação de links caso seja resposta em áudio (Dona Maria / !audio)
        let replyText = finalMessage;
        let linksText = '';

        if (replyText.includes('[LINKS_START]')) {
            const start = replyText.indexOf('[LINKS_START]');
            const end = replyText.indexOf('[LINKS_END]');
            if (end > start) {
                linksText = replyText.substring(start + '[LINKS_START]'.length, end).trim();
                replyText = replyText.substring(0, start).trim();
            }
        }

        if (isAudio) {
            // Remove possíveis marcadores adicionais para ficar limpo para leitura falada
            const audioScript = replyText.replace(/[\*\_\[\]]/g, '').trim();
            console.log(`[TTS] Enviando roteiro de voz: "${audioScript}"`);

            const audioFile = await textToSpeech(audioScript);
            if (audioFile) {
                const media = MessageMedia.fromFilePath(audioFile);
                await msg.reply(media, undefined, { sendAudioAsVoice: true });
                console.log('[Mensagem] Áudio enviado com sucesso.');
                fs.unlinkSync(audioFile); // Limpa arquivo temporário
            } else {
                // Fallback caso ElevenLabs falhe ou chave esteja ausente
                await msg.reply(`🎙️ *[Áudio (Fallback)]*\n\n${replyText}`);
            }

            // Envia os links de checagem em mensagem organizada subsequente
            if (linksText) {
                const chat = await msg.getChat();
                await chat.sendMessage(`🔗 *Links e Fontes da Checagem:*\n\n${linksText}`);
                console.log('[Mensagem] Links enviados separadamente.');
            }
        } else {
            // Resposta em texto normal (Enzo / João)
            // Se houver tags [LINKS_START], formata o texto limpando as tags e exibindo tudo junto
            let textResponse = finalMessage;
            if (textResponse.includes('[LINKS_START]')) {
                textResponse = textResponse
                    .replace('[LINKS_START]', '\n\n🔗 *Links e Fontes de Referência:*\n')
                    .replace('[LINKS_END]', '')
                    .trim();
            }
            await msg.reply(textResponse);
            console.log('[Mensagem] Resposta em texto enviada.');
        }

    } catch (err) {
        console.error('[Orquestrador] Erro no processamento do agente:', err);
        await msg.reply('⚠️ Ocorreu um erro interno ao processar a checagem de fatos.');
    }
});

client.initialize();
