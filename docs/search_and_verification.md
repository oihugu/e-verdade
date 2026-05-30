# Busca e Verificação de Fatos — e-verdade

Este documento descreve as diretrizes técnicas para a pesquisa na web, definição de fontes confiáveis, ordenação de links e checagem de temporalidade (timestamps) para o sistema de detecção de fake news.

---

## 1. Definição de Sites Confiáveis (Definir Sites)

Para evitar poluições e notícias falsas nos próprios resultados de busca, as consultas serão restritas ou priorizarão fontes categorizadas por confiabilidade:

### A. Agências de Fact-Checking (Prioridade Máxima)
*   **Agência Lupa** (`piaui.folha.uol.com.br/lupa/`)
*   **Aos Fatos** (`aosfatos.org`)
*   **Boatos.org** (`boatos.org`)
*   **Fato ou Fake - G1** (`g1.globo.com/fato-ou-fake/`)
*   **Estadão Verifica** (`estadao.com.br/estadao-verifica/`)
*   **UOL Confere** (`noticias.uol.com.br/confere/`)

### B. Fontes Institucionais e Governamentais
*   **Saúde/Ciência:** Organização Mundial da Saúde (OMS), Ministério da Saúde (governo federal), ANVISA, Fiocruz, Instituto Butantan.
*   **Dados Gerais:** IBGE, IPEA, TSE (Tribunal Superior Eleitoral - para notícias sobre eleições).

### C. Portais de Notícias de Alta Credibilidade
*   Canais de jornalismo profissional nacional e internacional reconhecidos pela neutralidade e rigor técnico.

---

## 2. Ordenação de Busca de Link (Ranking de Resultados)

Quando o sistema realiza a busca, ele recebe múltiplos resultados. O algoritmo de ordenação deve priorizá-los com base em:

1.  **Índice de Confiança do Domínio:** Resultados de agências de fact-checking têm peso maior se a busca envolver termos polêmicos ou virais.
2.  **Consonância Semântica:** Proximidade entre a consulta refinada pelo LLM e o título/resumo da página.
3.  **Consenso:** Se três fontes de fact-checking marcam a alegação como falsa, o link de esclarecimento dessas fontes deve subir para o topo do ranking, enquanto notícias que replicam o rumor são filtradas ou enviadas para o fim da lista.

---

## 3. Validação de Temporalidade (Timestamp)

Muitas notícias falsas são, na verdade, **notícias reais de anos anteriores** compartilhadas fora de contexto para criar pânico ou manipular a opinião pública no presente.

### Mecanismo de Validação Temporal:
*   **Extração de Data:** Capturar a data de publicação da página (meta tag `article:published_time` ou similar).
*   **Comparação Temporal:** Se o resultado for mais antigo do que 6 meses, o sistema aciona um alerta de "Notícia Antiga".
*   **Aviso ao Usuário:** A resposta do WhatsApp deve deixar explícito o ano original do evento para desarmar o compartilhamento desatualizado.
    *   *Exemplo de retorno:* "⚠️ **Essa notícia é antiga!** O fato relatado aconteceu em **2019** e não reflete a situação de hoje."
