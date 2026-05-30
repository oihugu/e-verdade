# Arquitetura do Sistema — e-verdade

Este documento apresenta a arquitetura geral do **e-verdade** (Fake News Detector via WhatsApp), mapeando a integração de todas as partes do sistema: a ponte com o WhatsApp, o pipeline de LLM, o módulo de busca de fatos e a conversão de texto em fala.

---

## 1. Visão Geral da Arquitetura

O e-verdade é projetado como uma arquitetura orientada a serviços e baseada em eventos. O fluxo de dados segue uma cadeia de processamento síncrona iniciada por mensagens de usuários no WhatsApp.

```mermaid
graph TD
    subgraph "Cliente (WhatsApp)"
        A[Usuário] <-->|Mensagens / Áudio| B[WhatsApp Business / API]
    end

    subgraph "Integração & Gateway"
        B <-->|Webhooks & Send API| C[Zap Bridge / Webhook Handler]
    end

    subgraph "Cérebro (Orquestrador)"
        C <-->|Mensagens Ingestão| D[Orquestrador LLM]
        D -->|Transcrição se Áudio| E[Speech-to-Text (Elevenlabs Whisper)]
        D -->|Síntese se Maria| F[Text-to-Speech (Elevenlabs)]
    end

    subgraph "Verificação de Dados"
        D <-->|Refinamento & Busca| G[Mecanismo de Busca na Web (Tool forçada toda execução)]
        G <-->|Filtro de Domínios Confiáveis| H((Bases de Fact-Checking))
    end

    classDef primary fill:#f9f,stroke:#333,stroke-width:2px;
    class D primary;
```

---

## 2. Componentes e Subistemas

### A. Camada de Integração (Zap Bridge)
*   **Papel:** Ponte entre o ecossistema do WhatsApp e os serviços internos do projeto.
*   **Tecnologia:** Serviço Node.js/TypeScript ou Python rodando um servidor Express/FastAPI que recebe payloads HTTP POST contendo as interações do WhatsApp.
*   **Funções:** Normalização de formatos de mídia e controle de concorrência de mensagens recebidas.

### B. Orquestrador LLM (O Cérebro)
*   **Papel:** Agente inteligente encarregado de tomar as decisões de roteamento, higienizar o contexto da sessão e produzir a resposta adaptada a cada persona.
*   **Funções:**
    *   **Higienização do Contexto:** Limpa e reseta o histórico/contexto da sessão do agente a cada execução para garantir que checagens ou interações anteriores não enviesem a tomada de decisão da tarefa atual.
    *   **Classificação de Viés:** Analisa a tonalidade partidária ou ideológica da notícia.
    *   **Formulação de Busca:** Converte o boato em uma consulta lógica e neutra de pesquisa.
    *   **Adequação de Tom:** Formata o texto final para ser amigável e direto.

### C. Módulo de Busca e Verificação (True Checker)
*   **Papel:** Pesquisa e ranqueamento de links confiáveis.
*   **Funções:** Executa buscas na web (ex: via Google Search API ou Tavily API), limita as buscas aos sites definidos e valida os timestamps de publicação das fontes para evitar boatos baseados em notícias antigas recicladas.

### D. Camada de Acessibilidade (Text-to-Speech)
*   **Papel:** Geração de respostas faladas para acessibilidade.
*   **Funções:** Sintetiza o roteiro gerado pelo LLM em áudio de alta qualidade e envia o arquivo formatado em `.ogg` (codec OPUS) para a API do WhatsApp.

---

## 3. Estratégia de Engajamento e Divulgação
> *"Como engajar e divulgar?"* (Sticky note rosa)

Para garantir a adesão orgânica e o crescimento do uso do e-verdade, a arquitetura de produto deve incluir recursos que incentivem o engajamento:

1.  **Fácil Compartilhamento (Loop de Indicação):**
    *   Ao final de cada checagem factual, o bot envia uma mensagem formatada de forma clara e limpa, acompanhada de um texto como:
        *   *"Gostou dessa checagem? Encaminhe esta mensagem para os seus grupos para evitar desinformação! Ou compartilhe o número do e-verdade: [link do número]"*.
2.  **Card Visual de Checagem:**
    *   Opcionalmente, o bot pode gerar um card em imagem com a classificação (FATO/FAKE) que é altamente compartilhável em grupos de família (perfeito para a persona *Maria* encaminhar e o jovem *Enzo* ver rapidamente no feed).
3.  **Lembrete de Acompanhamento (Follow-up):**
    *   Para notícias sobre temas de saúde ou política em andamento, o sistema pode registrar um alerta opcional e avisar o usuário se novas atualizações daquele fato forem encontradas, gerando recorrência no uso.
