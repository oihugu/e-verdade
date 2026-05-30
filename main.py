import base64
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from domains.orchestrator import process_message, transcribe_audio
from domains.rate_limiter import check_and_increment
from domains.tts import synthesize

app = FastAPI(title="e-verdade", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SEND_AUDIO = os.getenv("SEND_AUDIO", "true").lower() == "true"


# ── Request / Response models ──────────────────────────────────────────────────

class InboundMessage(BaseModel):
    from_number: str
    body: str = ""
    is_audio: bool = False
    audio_base64: str | None = None  # ogg/mp3 from bridge


class OutboundResponse(BaseModel):
    text: str
    audio_base64: str | None = None
    send_audio: bool = False


# ── WhatsApp formatting ────────────────────────────────────────────────────────

def _format_response(result: dict) -> str:
    status = result.get("status", "CONVERSA")

    if status == "CONVERSA":
        summary = result.get("short_summary", "")
        return summary or (
            "👋 Olá! Sou o *e-verdade* 🔍\n\n"
            "Envie uma notícia, rumor ou corrente e eu verifico para você!\n\n"
            "_Exemplo: encaminhe aquela mensagem suspeita do grupo da família._"
        )

    emoji = result.get("verdict_emoji", "⚠️")
    lines = [
        f"{emoji} *{status}*",
        "",
        f"*{result.get('short_summary', '')}*",
        "",
        result.get("explanation", ""),
    ]

    if result.get("is_old_news") and result.get("old_news_year"):
        lines += [
            "",
            f"⚠️ *Atenção: Notícia Antiga!*",
            f"Este evento aconteceu em *{result['old_news_year']}* e está circulando fora de contexto.",
        ]

    sources: list[dict] = result.get("sources") or []
    if sources:
        lines += ["", "📎 *Fontes verificadas:*"]
        for s in sources[:3]:
            title = s.get("title") or s.get("domain") or "Fonte"
            url = s.get("url", "")
            lines.append(f"• {title}")
            if url:
                lines.append(f"  {url}")

    lines += [
        "",
        "─────────────────────",
        "🔍 Verificado pelo *e-verdade*",
        "📲 Encaminhe para combater a desinformação!",
    ]

    return "\n".join(lines)


# ── Webhook endpoint ───────────────────────────────────────────────────────────

@app.post("/webhook", response_model=OutboundResponse)
async def webhook(msg: InboundMessage):
    # Rate limiting
    allowed, remaining = check_and_increment(msg.from_number)
    if not allowed:
        return OutboundResponse(
            text=(
                "⛔ Você atingiu o limite de *5 verificações por dia*.\n\n"
                "Volte amanhã para continuar checando notícias! 🔄"
            )
        )

    # Transcribe audio if needed
    text_to_check = msg.body
    if msg.is_audio and msg.audio_base64:
        try:
            audio_bytes = base64.b64decode(msg.audio_base64)
            text_to_check = await transcribe_audio(audio_bytes)
        except Exception as e:
            print(f"[transcription error] {e}")
            return OutboundResponse(
                text="❌ Não consegui entender o áudio. Tente enviar sua dúvida em texto!"
            )

    if not text_to_check.strip():
        return OutboundResponse(
            text=(
                "👋 Olá! Sou o *e-verdade* 🔍\n\n"
                "Envie uma notícia ou rumor para eu verificar!"
            )
        )

    # LLM pipeline
    result = await process_message(text_to_check)

    text_response = _format_response(result)

    # TTS for fact-check results (not for casual conversation)
    audio_b64 = None
    if SEND_AUDIO and result.get("status") not in ("CONVERSA", "ERRO"):
        script = result.get("audio_script", "")
        if script:
            try:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                    tmp_path = tmp.name
                await synthesize(script, tmp_path)
                audio_b64 = base64.b64encode(Path(tmp_path).read_bytes()).decode()
                Path(tmp_path).unlink(missing_ok=True)
            except Exception as e:
                print(f"[tts error] {e}")

    return OutboundResponse(
        text=text_response,
        audio_base64=audio_b64,
        send_audio=audio_b64 is not None,
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "e-verdade"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
