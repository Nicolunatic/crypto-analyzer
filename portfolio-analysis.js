const axios = require('axios');

// Lista de criptos consolidadas para analisar
const CRYPTOS_TO_ANALYZE = [
    'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC',
    'ATOM', 'UNI', 'LTC', 'NEAR', 'INJ', 'AAVE', 'FIL', 'FET', 'RENDER',
    'VET', 'ALGO', 'XLM', 'FTM', 'DOGE', 'TRX', 'ETC', 'XMR', 'HBAR'
];

async function analyzeForPortfolio() {
    console.log('='.repeat(90));
    console.log('ANÁLISE PARA MONTAGEM DE CARTEIRA - TOP 15 CRIPTOS');
    console.log('Critérios: Projeto sólido + Tempo de casa + Lucratividade MA50');
    console.log('='.repeat(90));
    console.log('');
    
    const results = [];
    
    for (const symbol of CRYPTOS_TO_ANALYZE) {
        process.stdout.write(`Analisando ${symbol}...`);
        
        try {
            const data = await fetchFullHistory(symbol);
            if (data) {
                results.push(data);
                console.log(` ✓ ${data.days} dias | MA50: ${data.ma50Profit >= 0 ? '+' : ''}${data.ma50Profit.toFixed(0)}%`);
            }
        } catch (e) {
            console.log(` ✗ Erro`);
        }
        
        await sleep(300);
    }
    
    // Ordenar por lucro MA50
    results.sort((a, b) => b.ma50Profit - a.ma50Profit);
    
    console.log('\n' + '='.repeat(90));
    console.log('RANKING COMPLETO - ORDENADO POR LUCRO MA50');
    console.log('='.repeat(90));
    console.log('');
    
    console.log(
        padRight('Rank', 5) +
        padRight('Cripto', 8) +
        padRight('Dias', 8) +
        padRight('Início', 12) +
        padRight('MA50 Lucro', 14) +
        padRight('HOLD Lucro', 14) +
        padRight('Trades', 8) +
        padRight('Vencedor', 10) +
        'Sinal Atual'
    );
    console.log('-'.repeat(90));
    
    results.forEach((r, i) => {
        const ma50Str = (r.ma50Profit >= 0 ? '+' : '') + r.ma50Profit.toFixed(0) + '%';
        const holdStr = (r.holdProfit >= 0 ? '+' : '') + r.holdProfit.toFixed(0) + '%';
        const winnerIcon = r.winner === 'MA50' ? '🏆 MA50' : '🔒 HOLD';
        const signalIcon = r.signal === 'buy' ? '🟢 COMPRAR' : (r.signal === 'sell' ? '🔴 VENDER' : '🟡 AGUARDAR');
        
        console.log(
            padRight((i + 1).toString(), 5) +
            padRight(r.symbol, 8) +
            padRight(r.days.toString(), 8) +
            padRight(r.startDate, 12) +
            padRight(ma50Str, 14) +
            padRight(holdStr, 14) +
            padRight(r.trades.toString(), 8) +
            padRight(winnerIcon, 10) +
            signalIcon
        );
    });
    
    // TOP 15 RECOMENDADOS
    console.log('\n' + '='.repeat(90));
    console.log('🎯 TOP 15 RECOMENDADOS PARA CARTEIRA DE LONGO PRAZO');
    console.log('='.repeat(90));
    console.log('');
    
    // Filtrar: mínimo 500 dias de histórico e MA50 > 0
    const qualified = results.filter(r => r.days >= 500 && r.ma50Profit > 0);
    const top15 = qualified.slice(0, 15);
    
    console.log('Critérios aplicados:');
    console.log('  ✓ Mínimo 500 dias de histórico');
    console.log('  ✓ Lucro MA50 positivo');
    console.log('  ✓ Projetos consolidados');
    console.log('');
    
    top15.forEach((r, i) => {
        const icon = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;
        console.log(`${icon} ${r.symbol.padEnd(6)} | MA50: +${r.ma50Profit.toFixed(0).padStart(6)}% | HOLD: +${r.holdProfit.toFixed(0).padStart(6)}% | ${r.days} dias | ${r.signal === 'buy' ? '🟢 COMPRAR' : r.signal === 'sell' ? '🔴 VENDER' : '🟡 AGUARDAR'}`);
    });
    
    // Lista final para copiar
    console.log('\n' + '='.repeat(90));
    console.log('📋 LISTA FINAL PARA COPIAR NO CÓDIGO:');
    console.log('='.repeat(90));
    console.log('');
    console.log('const TOP_15_PORTFOLIO = [');
    top15.forEach((r, i) => {
        const comment = `// ${r.ma50Profit >= 0 ? '+' : ''}${r.ma50Profit.toFixed(0)}% MA50, ${r.days} dias`;
        console.log(`    '${r.symbol}', ${comment}`);
    });
    console.log('];');
    
    // Resumo
    console.log('\n' + '='.repeat(90));
    console.log('📊 RESUMO DA CARTEIRA');
    console.log('='.repeat(90));
    const avgMA50 = top15.reduce((s, r) => s + r.ma50Profit, 0) / top15.length;
    const avgHold = top15.reduce((s, r) => s + r.holdProfit, 0) / top15.length;
    const buySignals = top15.filter(r => r.signal === 'buy').length;
    const sellSignals = top15.filter(r => r.signal === 'sell').length;
    
    console.log(`\nMédia de lucro MA50: +${avgMA50.toFixed(0)}%`);
    console.log(`Média de lucro HOLD: +${avgHold.toFixed(0)}%`);
    console.log(`\nSinais atuais:`);
    console.log(`  🟢 COMPRAR: ${buySignals} criptos`);
    console.log(`  🔴 VENDER: ${sellSignals} criptos`);
    console.log(`  🟡 AGUARDAR: ${top15.length - buySignals - sellSignals} criptos`);
}

async function fetchFullHistory(symbol) {
    const allKlines = [];
    let startTime = new Date('2017-01-01').getTime();
    const endTime = Date.now();
    
    while (startTime < endTime) {
        const response = await axios.get('https://api.binance.com/api/v3/klines', {
            params: {
                symbol: `${symbol}USDT`,
                interval: '1d',
                startTime,
                limit: 1000
            }
        });
        if (response.data.length === 0) break;
        allKlines.push(...response.data);
        startTime = response.data[response.data.length - 1][0] + 86400000;
        if (response.data.length < 1000) break;
    }
    
    if (allKlines.length < 50) return null;
    
    const prices = allKlines.map(k => parseFloat(k[4]));
    const currentPrice = prices[prices.length - 1];
    const initialPrice = prices[0];
    
    // HOLD
    const holdProfit = ((currentPrice - initialPrice) / initialPrice) * 100;
    
    // MA50
    let cash = 10000;
    let crypto = 0;
    let trades = 0;
    const period = 50;
    
    for (let i = period; i < prices.length; i++) {
        const ma = prices.slice(i - period, i).reduce((s, p) => s + p, 0) / period;
        const price = prices[i];
        
        if (price > ma && cash > 0) {
            crypto = cash / price;
            cash = 0;
            trades++;
        } else if (price < ma && crypto > 0) {
            cash = crypto * price;
            crypto = 0;
            trades++;
        }
    }
    
    const finalValue = cash + crypto * currentPrice;
    const ma50Profit = ((finalValue - 10000) / 10000) * 100;
    
    // MA50 atual
    const last50 = prices.slice(-50);
    const ma50 = last50.reduce((s, p) => s + p, 0) / 50;
    const distance = ((currentPrice - ma50) / ma50) * 100;
    let signal = 'hold';
    if (distance > 2) signal = 'buy';
    else if (distance < -2) signal = 'sell';
    
    return {
        symbol,
        days: allKlines.length,
        startDate: new Date(allKlines[0][0]).toISOString().split('T')[0],
        ma50Profit,
        holdProfit,
        trades,
        winner: ma50Profit > holdProfit ? 'MA50' : 'HOLD',
        signal,
        currentPrice,
        ma50
    };
}

function padRight(str, len) {
    return (str + ' '.repeat(len)).substring(0, len);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

analyzeForPortfolio().catch(console.error);
