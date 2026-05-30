import os
import httpx

_ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"


async def synthesize(text: str, output_path: str) -> str:
    """
    Convert text to speech with ElevenLabs and save as .ogg (opus).
    Returns the output_path on success.
    """
    api_key = os.environ["ELEVENLABS_API_KEY"]
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

    url = f"{_ELEVENLABS_BASE}/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.7, "similarity_boost": 0.8},
    }

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        with open(output_path, "wb") as f:
            f.write(r.content)

    return output_path
