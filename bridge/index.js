require("dotenv").config();
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const BACKEND_TIMEOUT_MS = parseInt(process.env.BACKEND_TIMEOUT_MS || "90000");

// ── WhatsApp client ───────────────────────────────────────────────────────────

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--no-first-run",
    ],
  },
});

client.on("qr", (qr) => {
  console.log("\n📱 Scan the QR code below to connect WhatsApp:\n");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("✅ WhatsApp authenticated — session saved.");
});

client.on("ready", () => {
  console.log("🚀 e-verdade bridge is ready and listening for messages.");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Authentication failed:", msg);
  process.exit(1);
});

client.on("disconnected", (reason) => {
  console.warn("⚠️  Disconnected:", reason);
  client.initialize();
});

// ── Message handler ───────────────────────────────────────────────────────────

client.on("message", async (message) => {
  // Skip group messages unless the bot is mentioned
  if (message.fromMe) return;
  if (message.isGroupMsg) {
    const mentioned = message.mentionedIds?.includes(client.info?.wid?._serialized);
    if (!mentioned) return;
  }

  const from = message.from;
  const chat = await message.getChat();

  await chat.sendStateTyping();

  try {
    let payload;

    if (message.hasMedia && message.type === "ptt") {
      // Incoming voice note → transcribe via backend
      const media = await message.downloadMedia();
      payload = {
        from_number: from,
        body: "",
        is_audio: true,
        audio_base64: media.data, // already base64
      };
    } else {
      payload = {
        from_number: from,
        body: message.body,
        is_audio: false,
        audio_base64: null,
      };
    }

    const response = await axios.post(`${BACKEND_URL}/webhook`, payload, {
      timeout: BACKEND_TIMEOUT_MS,
    });

    const { text, audio_base64, send_audio } = response.data;

    // Send text response
    await client.sendMessage(from, text);

    // Send voice note if backend generated audio
    if (send_audio && audio_base64) {
      const tmpFile = path.join(os.tmpdir(), `everdade_${Date.now()}.mp3`);
      fs.writeFileSync(tmpFile, Buffer.from(audio_base64, "base64"));

      const audioMedia = MessageMedia.fromFilePath(tmpFile);
      await client.sendMessage(from, audioMedia, { sendAudioAsVoice: true });

      fs.unlinkSync(tmpFile);
    }
  } catch (err) {
    console.error(`[error] processing message from ${from}:`, err.message);
    await client.sendMessage(
      from,
      "❌ Ocorreu um erro ao processar sua mensagem. Tente novamente em instantes."
    );
  } finally {
    await chat.clearState();
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

console.log("🔗 Starting e-verdade WhatsApp bridge...");
client.initialize();
