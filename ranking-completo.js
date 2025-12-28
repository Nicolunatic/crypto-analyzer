const axios = require('axios');

// Lista expandida de criptos para análise
const CRYPTOS = [
    // Já no TOP 14
    'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'AVAX', 'LINK', 'MATIC', 'UNI', 'NEAR', 'FET', 'VET', 'DOGE', 'HBAR',
    // Candidatas
    'XRP', 'DOT', 'ATOM', 'LTC', 'INJ', 'AAVE', 'FIL', 'RENDER', 'ALGO', 'XLM', 'TRX', 'ETC', 'XMR',
    'ARB', 'OP', 'SUI', 'APT', 'SEI', 'TIA', 'RUNE', 'EGLD', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ',
    'CRV', 'MKR', 'SNX', 'LDO', 'DYDX', 'GMX', 'PENDLE', 'GRT', 'IMX', 'THETA', 'QNT', 'RPL'
];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeAll() {
    console.log('='.repeat(65));
    console.log('ANÁLISE COMPLETA - RANKING DE CRIPTOS POR LUCRO MA50');
    console.log('='.repeat(65));
    
    const results = [];
    
    for (const symbol of CRYPTOS) {
        process.stdout.write(`Analisando ${symbol}... `);
        try {
            const response = await axios.get('https://api.binance.com/api/v3/klines', {
                params: { symbol: `${symbol}USDT`, interval: '1d', limit: 1000 }
            });
            
            const days = response.data.length;
            if (days < 100) {
                console.log('✗ Poucos dias');
                continue;
            }
            
            const prices = response.data.map(k => parseFloat(k[4]));
            let capital = 1000, position = 0, inPosition = false;
            
            // Calcular MA50 inicial
            let sum = 0;
            for (let i = 0; i < 50; i++) sum += prices[i];
            let ma50 = sum / 50;
            
            // Se preço inicial > MA50, começa comprado
            if (prices[49] > ma50) {
                position = capital / prices[49];
                capital = 0;
                inPosition = true;
            }
            
            // Simular trades
            for (let i = 50; i < prices.length; i++) {
                sum = 0;
                for (let j = i - 49; j <= i; j++) sum += prices[j];
                ma50 = sum / 50;
                
                const prev = prices[i - 1];
                const curr = prices[i];
                
                let prevSum = 0;
                for (let j = i - 50; j < i; j++) prevSum += prices[j];
                const prevMa = prevSum / 50;
                
                // Cruzou para cima
                if (!inPosition && prev <= prevMa && curr > ma50) {
                    position = capital / curr;
                    capital = 0;
                    inPosition = true;
                }
                // Cruzou para baixo
                else if (inPosition && prev >= prevMa && curr < ma50) {
                    capital = position * curr;
                    position = 0;
                    inPosition = false;
                }
            }
            
            const finalMa50 = inPosition ? position * prices[prices.length - 1] : capital;
            const finalHold = (1000 / prices[49]) * prices[prices.length - 1];
            
            const profitMa50 = Math.round((finalMa50 - 1000) / 1000 * 100);
            const profitHold = Math.round((finalHold - 1000) / 1000 * 100);
            const winner = profitMa50 > profitHold ? 'MA50' : 'HOLD';
            
            results.push({ symbol, days, profitMa50, profitHold, winner });
            console.log(`✓ ${days} dias | MA50: ${profitMa50 >= 0 ? '+' : ''}${profitMa50}%`);
            
        } catch (e) {
            console.log(`✗ Erro: ${e.message}`);
        }
        await sleep(100);
    }
    
    // Ordenar por lucro MA50
    results.sort((a, b) => b.profitMa50 - a.profitMa50);
    
    console.log('\n' + '='.repeat(65));
    console.log('RANKING COMPLETO - ORDENADO POR LUCRO MA50');
    console.log('='.repeat(65));
    console.log('\nRank  Cripto   Dias    MA50%      HOLD%     Winner   Status');
    console.log('-'.repeat(65));
    
    const TOP_14_ATUAL = ['BNB', 'SOL', 'DOGE', 'FET', 'VET', 'BTC', 'ETH', 'AVAX', 'ADA', 'HBAR', 'LINK', 'NEAR', 'MATIC', 'UNI'];
    
    results.forEach((r, i) => {
        const isTop14 = TOP_14_ATUAL.includes(r.symbol);
        const emoji = r.profitMa50 > 500 ? '🔥' : (r.profitMa50 > 0 ? '✅' : '❌');
        const status = isTop14 ? '📌 JÁ ESTÁ' : (r.profitMa50 > 100 ? '👀 CANDIDATA' : '');
        
        console.log(
            `${(i + 1).toString().padStart(2)}    ${r.symbol.padEnd(6)}   ${r.days.toString().padStart(4)}    ` +
            `${(r.profitMa50 >= 0 ? '+' : '') + r.profitMa50.toString().padStart(6)}%   ` +
            `${(r.profitHold >= 0 ? '+' : '') + r.profitHold.toString().padStart(6)}%    ` +
            `${emoji} ${r.winner.padEnd(4)}   ${status}`
        );
    });
    
    // Candidatas que não estão no TOP 14
    const candidatas = results.filter(r => !TOP_14_ATUAL.includes(r.symbol) && r.profitMa50 > 100);
    
    if (candidatas.length > 0) {
        console.log('\n' + '='.repeat(65));
        console.log('🎯 CANDIDATAS PARA ADICIONAR (não estão no TOP 14 atual)');
        console.log('='.repeat(65));
        candidatas.forEach((r, i) => {
            console.log(`${i + 1}. ${r.symbol} - MA50: +${r.profitMa50}% | HOLD: ${r.profitHold >= 0 ? '+' : ''}${r.profitHold}% | ${r.days} dias`);
        });
    }
    
    // Resumo
    const ma50Wins = results.filter(r => r.winner === 'MA50').length;
    console.log('\n' + '='.repeat(65));
    console.log('RESUMO');
    console.log('='.repeat(65));
    console.log(`Total analisadas: ${results.length}`);
    console.log(`MA50 vence: ${ma50Wins}/${results.length} (${Math.round(ma50Wins/results.length*100)}%)`);
    console.log(`Com lucro positivo MA50: ${results.filter(r => r.profitMa50 > 0).length}`);
}

analyzeAll().catch(console.error);
