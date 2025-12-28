const axios = require('axios');

// Top 50 criptos por market cap
const TOP_50_CRYPTOS = [
    'BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT',
    'TRX', 'MATIC', 'SHIB', 'LTC', 'BCH', 'ATOM', 'UNI', 'XLM', 'ETC', 'FIL',
    'APT', 'ARB', 'OP', 'NEAR', 'IMX', 'INJ', 'VET', 'ALGO', 'GRT', 'FTM',
    'SAND', 'MANA', 'AXS', 'THETA', 'EOS', 'AAVE', 'XTZ', 'FLOW', 'NEO', 'CHZ',
    'CRV', 'EGLD', 'KAVA', 'GALA', 'ENJ', 'ROSE', 'ZIL', 'ENS', '1INCH', 'LRC'
];

async function analyzeMA50vsHold() {
    console.log('='.repeat(100));
    console.log('ANALISE MA50 CROSSOVER vs HOLD - TOP 50 CRIPTOMOEDAS');
    console.log('='.repeat(100));
    console.log('');
    
    const results = [];
    let processed = 0;
    
    for (const symbol of TOP_50_CRYPTOS) {
        process.stdout.write(`\rAnalisando ${symbol}... (${++processed}/${TOP_50_CRYPTOS.length})`);
        
        try {
            const prices = await fetchPrices(symbol);
            
            if (prices.length < 100) {
                console.log(`\n  ${symbol}: Dados insuficientes (${prices.length} dias)`);
                continue;
            }
            
            const holdResult = strategyHold(prices, 10000);
            const ma50Result = strategyMA50(prices, 10000);
            
            const winner = ma50Result.profit > holdResult.profit ? 'MA50' : 'HOLD';
            const diff = ma50Result.profit - holdResult.profit;
            
            results.push({
                symbol,
                days: prices.length,
                hold: holdResult.profit,
                ma50: ma50Result.profit,
                ma50Trades: ma50Result.trades,
                winner,
                diff
            });
            
        } catch (error) {
            // Silently skip errors
        }
        
        await sleep(300);
    }
    
    console.log('\n\n');
    
    // Ordenar por diferença (MA50 - HOLD)
    results.sort((a, b) => b.diff - a.diff);
    
    // TABELA COMPLETA
    console.log('='.repeat(100));
    console.log('RESULTADO COMPLETO - MA50 vs HOLD');
    console.log('='.repeat(100));
    console.log('');
    console.log(
        padRight('Rank', 5) +
        padRight('Cripto', 8) +
        padRight('Dias', 7) +
        padRight('HOLD', 14) +
        padRight('MA50', 14) +
        padRight('Trades', 8) +
        padRight('Vencedor', 10) +
        'Diferença'
    );
    console.log('-'.repeat(100));
    
    results.forEach((r, i) => {
        const holdStr = (r.hold >= 0 ? '+' : '') + r.hold.toFixed(1) + '%';
        const ma50Str = (r.ma50 >= 0 ? '+' : '') + r.ma50.toFixed(1) + '%';
        const diffStr = (r.diff >= 0 ? '+' : '') + r.diff.toFixed(1) + '%';
        const icon = r.winner === 'MA50' ? '📈' : '🔒';
        
        console.log(
            padRight((i + 1).toString(), 5) +
            padRight(r.symbol, 8) +
            padRight(r.days.toString(), 7) +
            padRight(holdStr, 14) +
            padRight(ma50Str, 14) +
            padRight(r.ma50Trades.toString(), 8) +
            padRight(icon + ' ' + r.winner, 10) +
            diffStr
        );
    });
    
    // ESTATISTICAS
    const ma50Wins = results.filter(r => r.winner === 'MA50').length;
    const holdWins = results.filter(r => r.winner === 'HOLD').length;
    const avgHold = results.reduce((s, r) => s + r.hold, 0) / results.length;
    const avgMA50 = results.reduce((s, r) => s + r.ma50, 0) / results.length;
    
    console.log('\n' + '='.repeat(100));
    console.log('ESTATISTICAS GERAIS');
    console.log('='.repeat(100));
    console.log(`\nTotal de criptos analisadas: ${results.length}`);
    console.log(`\n📈 MA50 venceu em: ${ma50Wins} criptos (${(ma50Wins/results.length*100).toFixed(1)}%)`);
    console.log(`🔒 HOLD venceu em: ${holdWins} criptos (${(holdWins/results.length*100).toFixed(1)}%)`);
    console.log(`\nLucro médio HOLD: ${avgHold >= 0 ? '+' : ''}${avgHold.toFixed(1)}%`);
    console.log(`Lucro médio MA50: ${avgMA50 >= 0 ? '+' : ''}${avgMA50.toFixed(1)}%`);
    
    // TOP 10 onde MA50 foi MUITO melhor
    console.log('\n' + '='.repeat(100));
    console.log('TOP 10 - ONDE MA50 FOI MUITO MELHOR QUE HOLD');
    console.log('='.repeat(100));
    
    results.filter(r => r.winner === 'MA50').slice(0, 10).forEach((r, i) => {
        console.log(`${i + 1}. ${r.symbol}: MA50 ${r.ma50 >= 0 ? '+' : ''}${r.ma50.toFixed(0)}% vs HOLD ${r.hold >= 0 ? '+' : ''}${r.hold.toFixed(0)}% (MA50 ganhou por ${r.diff.toFixed(0)}%)`);
    });
    
    // TOP 10 onde HOLD foi melhor
    console.log('\n' + '='.repeat(100));
    console.log('TOP 10 - ONDE HOLD FOI MELHOR QUE MA50');
    console.log('='.repeat(100));
    
    results.filter(r => r.winner === 'HOLD').slice(-10).reverse().forEach((r, i) => {
        console.log(`${i + 1}. ${r.symbol}: HOLD ${r.hold >= 0 ? '+' : ''}${r.hold.toFixed(0)}% vs MA50 ${r.ma50 >= 0 ? '+' : ''}${r.ma50.toFixed(0)}% (HOLD ganhou por ${Math.abs(r.diff).toFixed(0)}%)`);
    });
    
    // CONCLUSAO
    console.log('\n' + '='.repeat(100));
    console.log('CONCLUSAO FINAL');
    console.log('='.repeat(100));
    
    if (ma50Wins > holdWins) {
        console.log(`\n✅ MA50 CROSSOVER é a estratégia vencedora!`);
        console.log(`   Venceu em ${ma50Wins}/${results.length} criptos (${(ma50Wins/results.length*100).toFixed(0)}%)`);
    } else {
        console.log(`\n✅ HOLD é a estratégia vencedora!`);
        console.log(`   Venceu em ${holdWins}/${results.length} criptos (${(holdWins/results.length*100).toFixed(0)}%)`);
    }
    
    console.log(`\n📊 Em média, MA50 ${avgMA50 > avgHold ? 'supera' : 'perde para'} HOLD por ${Math.abs(avgMA50 - avgHold).toFixed(1)}%`);
    
    // Salvar resultados
    const fs = require('fs');
    fs.writeFileSync('ma50-results.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Resultados salvos em ma50-results.json');
}

async function fetchPrices(symbol) {
    const allKlines = [];
    let startTime = new Date('2017-01-01').getTime();
    const endTime = Date.now();
    
    while (startTime < endTime) {
        const response = await axios.get('https://api.binance.com/api/v3/klines', {
            params: { symbol: symbol + 'USDT', interval: '1d', startTime, limit: 1000 }
        });
        if (response.data.length === 0) break;
        allKlines.push(...response.data);
        startTime = response.data[response.data.length - 1][0] + 86400000;
        if (response.data.length < 1000) break;
    }
    
    return allKlines.map(k => ({
        date: new Date(k[0]).toISOString().split('T')[0],
        close: parseFloat(k[4])
    }));
}

function strategyHold(prices, initial) {
    const crypto = initial / prices[0].close;
    const finalValue = crypto * prices[prices.length - 1].close;
    return {
        finalValue,
        profit: (finalValue - initial) / initial * 100,
        trades: 1
    };
}

function strategyMA50(prices, initial) {
    let cash = initial;
    let crypto = 0;
    let trades = 0;
    const period = 50;
    
    for (let i = period; i < prices.length; i++) {
        const ma = prices.slice(i - period, i).reduce((s, p) => s + p.close, 0) / period;
        const price = prices[i].close;
        
        // Comprar quando preço cruza acima da MA
        if (price > ma && cash > 0) {
            crypto = cash / price;
            cash = 0;
            trades++;
        }
        // Vender quando preço cruza abaixo da MA
        else if (price < ma && crypto > 0) {
            cash = crypto * price;
            crypto = 0;
            trades++;
        }
    }
    
    const finalValue = cash + crypto * prices[prices.length - 1].close;
    return {
        finalValue,
        profit: (finalValue - initial) / initial * 100,
        trades
    };
}

function padRight(str, len) {
    return (str + ' '.repeat(len)).substring(0, len);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

analyzeMA50vsHold().catch(console.error);
