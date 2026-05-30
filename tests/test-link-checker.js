// Usando fetch nativo do Node.js

async function isLinkValid(url) {
    try {
        console.log(`[Test] Verificando link: ${url}`);
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
        } catch (e) {
            console.log(`[Test] HEAD falhou, tentando GET...`);
        }
        
        clearTimeout(timeoutId);
        
        if (response && response.status >= 200 && response.status < 400) {
            console.log(`[Test] HEAD Sucedido: ${response.status}`);
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
        console.log(`[Test] GET Resposta: ${getResponse.status}`);
        return getResponse.status >= 200 && getResponse.status < 400;
    } catch (error) {
        console.log(`[Test] Erro ao validar: ${error.message}`);
        return false;
    }
}

async function run() {
    const urls = [
        'https://g1.globo.com/fato-ou-fake/',
        'https://lupa.uol.com.br/',
        'https://www.aosfatos.org/',
        'https://g1.globo.com/fato-ou-fake/nao-existe-404-teste',
        'https://invalid.domain.that.does.not.exist.xyz/'
    ];

    for (const url of urls) {
        const valid = await isLinkValid(url);
        console.log(`Resultado para ${url}: ${valid ? '✅ ATIVO' : '❌ QUEBRADO'}\n`);
    }
}

run();
