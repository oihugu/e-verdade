import json
import os
from openai import AsyncOpenAI
from .search import search_facts

_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

_SYSTEM_PROMPT = """Você é o e-verdade, um verificador de notícias neutro e acessível para brasileiros no WhatsApp.

Siga este pipeline rigorosamente:

**FASE 1 — Higienização e Classificação**
Determine se a mensagem contém uma alegação factual verificável (notícia, rumor, dado, corrente) ou é apenas conversa/saudação.

**FASE 2 — Busca (apenas se verificável)**
Formule uma query de busca neutra em português e chame a ferramenta `search_web`. Foque em fatos, não em opiniões.
Exemplo: "vacina gripe causa doenças" → query: "vacina gripe efeitos colaterais comprovados ANVISA"

**FASE 3 — Análise**
Com base nos resultados:
- Determine: FATO ✅, FAKE ❌, ou IMPRECISO ⚠️
- Verifique se é notícia antiga sendo recompartilhada (alerte com o ano original)
- Identifique viés partidário/ideológico na mensagem (neutralize na resposta)

**FASE 4 — Resposta em JSON**
Retorne APENAS um objeto JSON válido com esta estrutura exata:
{
  "status": "FATO" | "FAKE" | "IMPRECISO" | "CONVERSA",
  "verdict_emoji": "✅" | "❌" | "⚠️" | "💬",
  "short_summary": "Uma frase com o veredicto principal",
  "explanation": "2-3 frases explicando o resultado com base nas fontes",
  "sources": [{"title": "...", "url": "...", "domain": "..."}],
  "is_old_news": false,
  "old_news_year": null,
  "bias_detected": false,
  "audio_script": "Versão para áudio: sem URLs, sem emojis, tom acolhedor e direto. Máximo 3 frases.",
  "share_text": "Texto curto e formatado para a pessoa encaminhar nos grupos"
}

**REGRAS:**
- Sempre neutro, factual, sem julgamento moral ou político
- Se não encontrou evidências suficientes → IMPRECISO
- Linguagem simples, acessível, sem jargões
- Retorne JSON válido como resposta final, sem texto adicional fora do JSON
"""

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Busca fatos em fontes confiáveis de fact-checking e órgãos institucionais brasileiros",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Query de busca neutra e objetiva em português",
                    }
                },
                "required": ["query"],
            },
        },
    }
]

_FALLBACK = {
    "status": "IMPRECISO",
    "verdict_emoji": "⚠️",
    "short_summary": "Não consegui verificar esta informação no momento.",
    "explanation": "Tente novamente em alguns instantes.",
    "sources": [],
    "is_old_news": False,
    "old_news_year": None,
    "bias_detected": False,
    "audio_script": "Não consegui verificar esta informação agora. Por favor, tente novamente em alguns instantes.",
    "share_text": "",
}


async def process_message(message: str) -> dict:
    """Run the full 4-phase LLM pipeline and return a structured result dict."""
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": f"Analise esta mensagem:\n\n{message}"},
    ]

    for _ in range(5):  # max iterations to prevent infinite loops
        response = await _client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=messages,
            tools=_TOOLS,
            tool_choice="auto",
            temperature=0.2,
        )

        choice = response.choices[0]

        if choice.finish_reason == "tool_calls":
            assistant_msg = choice.message
            messages.append(assistant_msg)

            for call in assistant_msg.tool_calls:
                if call.function.name == "search_web":
                    args = json.loads(call.function.arguments)
                    results = search_facts(args["query"])
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.id,
                            "content": json.dumps(results, ensure_ascii=False),
                        }
                    )
        else:
            content = choice.message.content or ""
            # Strip markdown code fences if present
            content = content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return {**_FALLBACK, "short_summary": content, "audio_script": content}

    return _FALLBACK


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.ogg") -> str:
    """Transcribe audio using OpenAI Whisper."""
    import io
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename

    transcript = await _client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        language="pt",
    )
    return transcript.text
