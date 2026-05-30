import fs from 'fs';
import path from 'path';

// Simula a importação das funções de index.js
// Para testar sem iniciar o cliente WhatsApp, podemos ler o arquivo e extrair/avaliar a função, ou apenas recriá-la temporariamente.
// No entanto, como index.js exporta apenas por efeitos colaterais (inicia o bot), vamos carregar a lógica dinamicamente ou copiar a função para o teste.

async function isLinkValid(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        let response;
        try {
            response = await fetch(url, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                signal: controller.signal
            });
        } catch (e) {}
        
        clearTimeout(timeoutId);
        
        if (response && response.status >= 200 && response.status < 400) {
            return true;
        }
        
        const getController = new AbortController();
        const getTimeoutId = setTimeout(() => getController.abort(), 4000);
        
        const getResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: getController.signal
        });
        
        clearTimeout(getTimeoutId);
        
        return getResponse.status >= 200 && getResponse.status < 400;
    } catch (error) {
        return false;
    }
}

async function filterBrokenLinks(text) {
	if (!text) return '';

	const startTag = '[LINKS_START]';
	const endTag = '[LINKS_END]';
	
	let mainText = text;
	let linksSection = '';

	if (text.includes(startTag)) {
		const startIdx = text.indexOf(startTag);
		const endIdx = text.indexOf(endTag);
		if (endIdx > startIdx) {
			mainText = text.substring(0, startIdx).trim();
			linksSection = text.substring(startIdx + startTag.length, endIdx).trim();
		}
	}

	if (linksSection) {
		const lines = linksSection.split('\n');
		const validLines = [];
		for (const line of lines) {
			const urls = line.match(/https?:\/\/[^\s\)\],]+/gi);
			if (urls && urls.length > 0) {
				let allUrlsValid = true;
				for (const url of urls) {
					const valid = await isLinkValid(url);
					if (!valid) {
						allUrlsValid = false;
						break;
					}
				}
				if (allUrlsValid) {
					validLines.push(line);
				} else {
					console.log(`[Validador Links] Removendo linha com link quebrado da lista: "${line.trim()}"`);
				}
			} else {
				validLines.push(line);
			}
		}
		
		const cleanedLines = validLines.filter(l => l.trim().length > 0);
		
		const hasLinks = cleanedLines.some(l => l.match(/https?:\/\/[^\s\)\],]+/gi));
		if (hasLinks) {
			return `${mainText}\n\n${startTag}\n${cleanedLines.join('\n')}\n${endTag}`;
		} else {
			return mainText;
		}
	}

	const lines = text.split('\n');
	const validLines = [];
	for (const line of lines) {
		const urls = line.match(/https?:\/\/[^\s\)\],]+/gi);
		if (urls && urls.length > 0) {
			let allUrlsValid = true;
			for (const url of urls) {
				const valid = await isLinkValid(url);
				if (!valid) {
					allUrlsValid = false;
					break;
				}
			}
			if (allUrlsValid) {
				validLines.push(line);
			} else {
				console.log(`[Validador Links] Removendo linha com link quebrado do texto: "${line.trim()}"`);
			}
		} else {
			validLines.push(line);
		}
	}
	return validLines.join('\n');
}

async function run() {
    const inputMessage = `**🔴 FAKE**

Isso é boato. Veja as checagens oficiais:

[LINKS_START]
- G1 Fato ou Fake: https://g1.globo.com/fato-ou-fake/
- Lupa (UOL): https://lupa.uol.com.br/
- Link Quebrado 1: https://g1.globo.com/fato-ou-fake/nao-existe-404-teste
- Agência de Checagem: https://www.aosfatos.org/
- Link Quebrado 2: https://invalid.domain.that.does.not.exist.xyz/
[LINKS_END]`;

    console.log("=== ENTRADA ORIGINAL ===");
    console.log(inputMessage);
    console.log("========================\n");

    console.log("Processando e limpando...");
    const output = await filterBrokenLinks(inputMessage);

    console.log("\n=== SAÍDA APÓS FILTRAGEM ===");
    console.log(output);
    console.log("============================\n");
}

run();
