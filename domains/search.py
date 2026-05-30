import os
from tavily import TavilyClient

_TRUSTED_DOMAINS = [
    "aosfatos.org",
    "boatos.org",
    "g1.globo.com",
    "estadao.com.br",
    "noticias.uol.com.br",
    "piaui.folha.uol.com.br",
    "agenciabrasil.ebc.com.br",
    "who.int",
    "saude.gov.br",
    "anvisa.gov.br",
    "fiocruz.br",
    "butantan.gov.br",
    "ibge.gov.br",
    "tse.jus.br",
    "ipea.gov.br",
]


def search_facts(query: str, max_results: int = 5) -> dict:
    """Search trusted fact-checking and institutional sources via Tavily."""
    client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
    return client.search(
        query=query,
        search_depth="advanced",
        max_results=max_results,
        include_domains=_TRUSTED_DOMAINS,
        include_answer=True,
        include_raw_content=False,
    )
