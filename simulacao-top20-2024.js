const axios = require('axios');

// Simulação: $10.000 investidos em 01/01/2024 divididos em 20 criptos
const INVESTIMENTO_INICIAL = 10000;
const DATA_INICIO = '2024-01-01';
const DATA_FIM = '2024-12-28';

const TOP_20_PORTFOLIO = [
    'SUI', 'SOL', 'PENDLE', 'SEI', 'HBAR', 'RUNE', 'FET', 'XLM', 'BTC', 'AAVE',
    'BNB', 'LINK', 'ETH', 'DOGE', 'UNI', 'ALGO', 'GRT', 'AVAX', 'VET', 'NEAR'
];

const VALOR_POR_CRIPTO = INVESTIMENTO_INICIAL / TOP_20_PORTFOLIO.length;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getHistoricalData(symbol, startDate, endDate) {
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
            symbol: `${symbol}USDT`,
            interval: '1d',
            startTime: startTime,
            endTime: endTime,
            limit: 1000
        }
    });
    
    return response.data.map(k => ({
        date: new Date(k[0]).toISOString().split('T')[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4])
    }));
}

function calculateMA50(prices, index) {
    if (index < 49) return null;
    let sum = 0;
    for (let i = index - 49; i <= index; i++) {
        sum += prices[i].close;
    }
    return sum / 50;
}

async function simulateCrypto(symbol) {
    process.stdout.write(`Simulando ${symbol}... `);
    
    // Buscar dados desde Nov/2023 para ter MA50 no início de 2024
    const preData = await getHistoricalData(symbol, '2023-11-01', DATA_FIM);
    
    if (preData.length < 60) {
        console.log(`⚠️ Dados insuficientes`);
        return null;
    }
    
    // Encontrar índice de 01/01/2024
    const startIndex = preData.findIndex(d => d.date >= DATA_INICIO);
    if (startIndex < 50) {
        console.log(`⚠️ Sem MA50 disponível`);
        return null;
    }
    
    const precoInicial = preData[startIndex].close;
    const precoFinal = preData[preData.length - 1].close;
    
    // Simulação MA50
    let capital = VALOR_POR_CRIPTO;
    let posicao = 0;
    let emPosicao = false;
    let trades = 0;
    
    // Verificar sinal inicial
    const ma50Inicial = calculateMA50(preData, startIndex);
    if (precoInicial > ma50Inicial) {
        posicao = capital / precoInicial;
        capital = 0;
        emPosicao = true;
    }
    
    // Simular dia a dia
    for (let i = startIndex + 1; i < preData.length; i++) {
        const preco = preData[i].close;
        const ma50 = calculateMA50(preData, i);
        const ma50Anterior = calculateMA50(preData, i - 1);
        const precoAnterior = preData[i - 1].close;
        
        if (!ma50 || !ma50Anterior) continue;
        
        // Cruzamento para cima
        if (!emPosicao && precoAnterior <= ma50Anterior && preco > ma50) {
            posicao = capital / preco;
            capital = 0;
            emPosicao = true;
            trades++;
        }
        // Cruzamento para baixo
        else if (emPosicao && precoAnterior >= ma50Anterior && preco < ma50) {
            capital = posicao * preco;
            posicao = 0;
            emPosicao = false;
            trades++;
        }
    }
    
    // Valor final
    let valorFinalMA50 = capital;
    if (emPosicao) {
        valorFinalMA50 = posicao * precoFinal;
    }
    
    // Valor HOLD
    const qtdHold = VALOR_POR_CRIPTO / precoInicial;
    const valorFinalHold = qtdHold * precoFinal;
    
    const lucroMA50 = ((valorFinalMA50 - VALOR_POR_CRIPTO) / VALOR_POR_CRIPTO) * 100;
    const lucroHold = ((valorFinalHold - VALOR_POR_CRIPTO) / VALOR_POR_CRIPTO) * 100;
    
    const vencedor = lucroMA50 > lucroHold ? 'MA50' : 'HOLD';
    const emoji = vencedor === 'MA50' ? '🏆' : '  ';
    
    console.log(`${emoji} MA50: ${lucroMA50 >= 0 ? '+' : ''}${lucroMA50.toFixed(0)}% | HOLD: ${lucroHold >= 0 ? '+' : ''}${lucroHold.toFixed(0)}%`);
    
    return {
        symbol,
        precoInicial,
        precoFinal,
        trades,
        valorFinalMA50,
        valorFinalHold,
        lucroMA50,
        lucroHold,
        vencedor,
        emPosicao
    };
}

async function runSimulation() {
    console.log('='.repeat(75));
    console.log('SIMULAÇÃO 2024: $10.000 INVESTIDOS NO TOP 20 PORTFOLIO');
    console.log('Estratégia: MA50 CrossOver vs HOLD');
    console.log('='.repeat(75));
    console.log(`\n💰 Investimento inicial: $${INVESTIMENTO_INICIAL.toLocaleString()}`);
    console.log(`📅 Período: ${DATA_INICIO} até ${DATA_FIM}`);
    console.log(`🪙 Criptos: ${TOP_20_PORTFOLIO.length}`);
    console.log(`💵 Valor por cripto: $${VALOR_POR_CRIPTO.toFixed(2)}\n`);
    
    const resultados = [];
    
    for (const symbol of TOP_20_PORTFOLIO) {
        try {
            const resultado = await simulateCrypto(symbol);
            if (resultado) {
                resultados.push(resultado);
            }
        } catch (error) {
            console.log(`❌ Erro: ${error.message}`);
        }
        await sleep(150);
    }
    
    // Ordenar por lucro MA50
    resultados.sort((a, b) => b.lucroMA50 - a.lucroMA50);
    
    // Resumo
    console.log('\n' + '='.repeat(75));
    console.log('📊 RESULTADO POR CRIPTO (ordenado por lucro MA50)');
    console.log('='.repeat(75));
    console.log('Cripto     Investido    Final MA50     Final HOLD    MA50%     HOLD%    Winner');
    console.log('-'.repeat(75));
    
    for (const r of resultados) {
        const winnerIcon = r.vencedor === 'MA50' ? '🏆' : '  ';
        console.log(
            `${r.symbol.padEnd(10)} ` +
            `$${VALOR_POR_CRIPTO.toFixed(0).padStart(6)}    ` +
            `$${r.valorFinalMA50.toFixed(0).padStart(8)}     ` +
            `$${r.valorFinalHold.toFixed(0).padStart(8)}    ` +
            `${(r.lucroMA50 >= 0 ? '+' : '') + r.lucroMA50.toFixed(0).padStart(5)}%   ` +
            `${(r.lucroHold >= 0 ? '+' : '') + r.lucroHold.toFixed(0).padStart(5)}%   ` +
            `${winnerIcon} ${r.vencedor}`
        );
    }
    
    // Totais
    const totalMA50 = resultados.reduce((sum, r) => sum + r.valorFinalMA50, 0);
    const totalHold = resultados.reduce((sum, r) => sum + r.valorFinalHold, 0);
    const investido = resultados.length * VALOR_POR_CRIPTO;
    const lucroTotalMA50 = ((totalMA50 - investido) / investido) * 100;
    const lucroTotalHold = ((totalHold - investido) / investido) * 100;
    const ma50Wins = resultados.filter(r => r.vencedor === 'MA50').length;
    
    console.log('-'.repeat(75));
    console.log(
        `${'TOTAL'.padEnd(10)} ` +
        `$${investido.toFixed(0).padStart(6)}    ` +
        `$${totalMA50.toFixed(0).padStart(8)}     ` +
        `$${totalHold.toFixed(0).padStart(8)}    ` +
        `${(lucroTotalMA50 >= 0 ? '+' : '') + lucroTotalMA50.toFixed(0).padStart(5)}%   ` +
        `${(lucroTotalHold >= 0 ? '+' : '') + lucroTotalHold.toFixed(0).padStart(5)}%`
    );
    
    console.log('\n' + '='.repeat(75));
    console.log('💰 RESULTADO FINAL DA SIMULAÇÃO 2024');
    console.log('='.repeat(75));
    console.log(`\n📅 Período: ${DATA_INICIO} → ${DATA_FIM} (1 ano)`);
    console.log(`💵 Investimento inicial: $${investido.toLocaleString()}`);
    console.log('');
    console.log(`📈 ESTRATÉGIA MA50:`);
    console.log(`   Valor final:  $${totalMA50.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`   Lucro:        ${lucroTotalMA50 >= 0 ? '+' : ''}${lucroTotalMA50.toFixed(2)}%`);
    console.log(`   Lucro em $:   ${lucroTotalMA50 >= 0 ? '+' : ''}$${(totalMA50 - investido).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log('');
    console.log(`📊 ESTRATÉGIA HOLD:`);
    console.log(`   Valor final:  $${totalHold.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`   Lucro:        ${lucroTotalHold >= 0 ? '+' : ''}${lucroTotalHold.toFixed(2)}%`);
    console.log(`   Lucro em $:   ${lucroTotalHold >= 0 ? '+' : ''}$${(totalHold - investido).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log('');
    console.log(`🏆 VENCEDOR GERAL: ${totalMA50 > totalHold ? 'MA50 CrossOver' : 'HOLD'}`);
    console.log(`   Diferença: $${Math.abs(totalMA50 - totalHold).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`   MA50 venceu em ${ma50Wins}/${resultados.length} criptos (${((ma50Wins/resultados.length)*100).toFixed(0)}%)`);
    console.log('='.repeat(75));
}

runSimulation().catch(console.error);
