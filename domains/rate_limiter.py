import json
from datetime import date
from pathlib import Path

_LIMIT_FILE = Path("/tmp/e_verdade_limits.json")
DAILY_LIMIT = 5


def _load() -> dict:
    if _LIMIT_FILE.exists():
        try:
            return json.loads(_LIMIT_FILE.read_text())
        except Exception:
            return {}
    return {}


def _save(data: dict) -> None:
    _LIMIT_FILE.write_text(json.dumps(data))


def check_and_increment(phone: str) -> tuple[bool, int]:
    """Return (allowed, remaining) after counting this request."""
    today = str(date.today())
    data = _load()
    key = f"{phone}:{today}"
    count = data.get(key, 0)

    if count >= DAILY_LIMIT:
        return False, 0

    data[key] = count + 1
    _save(data)
    return True, DAILY_LIMIT - (count + 1)
