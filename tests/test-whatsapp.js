import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';

dotenv.config();

console.log('Inicializando cliente do WhatsApp...');

// Inicialização com argumentos Puppeteer compatíveis com ambientes Linux sem interface gráfica
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
    console.log('ESCANEIE O QR CODE ABAIXO USANDO O SEU WHATSAPP:');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n======================================================');
    console.log('Conexão estabelecida com sucesso! O bot está pronto.');
    console.log('Envie "!ping" para o número do bot para testar.');
    console.log('======================================================\n');
});

const whitelist = ['195206381084836', '195206381084836@lid'];

client.on('message', async (msg) => {
    const senderNumber = msg.from.split('@')[0];
    if (!whitelist.includes(senderNumber) && !whitelist.includes(msg.from)) {
        console.log(`Mensagem de [${msg.from}] ignorada (não está na whitelist).`);
        return;
    }

    if (msg.body.trim() === '!ping') {
        console.log(`Mensagem recebida de [${msg.from}]: !ping. Respondendo...`);
        try {
            await msg.reply('pong');
            console.log('Resposta "pong" enviada com sucesso!');
        } catch (err) {
            console.error('Erro ao responder mensagem:', err);
        }
    }
});

client.initialize();
