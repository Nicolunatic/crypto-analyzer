const axios = require('axios');

const STRATEGIES = [
    { name: 'HOLD', buyAt: 0, sellAt: 100, desc: 'Comprar e segurar' },
    { name: 'Conservador', buyAt: 20, sellAt: 90, desc: 'Medo Extremo -> Ganancia Extrema' },
    { name: 'Moderado', buyAt: 25, sellAt: 80, desc: 'Medo Forte -> Ganancia Alta' },
    { name: 'Agressivo', buyAt: 40, sellAt: 75, desc: 'Medo -> Ganancia' },
    { name: 'Ultra Conservador', buyAt: 15, sellAt: 85, desc: 'So Medo Extremo' },
];

async function analyzeAllCryptos() {
    console.log('='.repeat(80));
    console.log('ANALISE COMPLETA - MELHOR ESTRATEGIA POR CRIPTOMOEDA');
    console.log('='.repeat(80));
    console.log('');
    
    // Buscar F&G uma vez
    console.log('Buscando historico Fear & Greed...');
    const fngResponse = await axios.get('https://api.alternative.me/fng/?limit=0');
    const fngMap = {};
    fngResponse.data.data.forEach(f => {
        const date = new Date(parseInt(f.timestamp) * 1000).toISOString().split('T')[0];
        fngMap[date] = parseInt(f.value);
    });
    console.log('F&G carregado: ' + Object.keys(fngMap).length + ' dias\n');
    
    // Lista de criptos para analisar
    const cryptos = [
        'BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC',
        'LINK', 'SHIB', 'LTC', 'BCH', 'ATOM', 'UNI', 'XLM', 'ETC', 'NEAR', 'APT',
        'FIL', 'ARB', 'OP', 'INJ', 'RUNE', 'AAVE', 'GRT', 'MKR', 'ALGO', 'VET'
    ];
    
    const results = [];
    
    for (const symbol of cryptos) {
        process.stdout.write('Analisando ' + symbol + '... ');
        
        try {
            const analysis = await analyzeCrypto(symbol, fngMap);
            if (analysis) {
                results.push(analysis);
                console.log('OK - Melhor: ' + analysis.bestStrategy.name + ' (' + analysis.bestStrategy.profit.toFixed(1) + '%)');
            } else {
                console.log('Sem dados suficientes');
            }
        } catch (error) {
            console.log('Erro: ' + error.message);
        }
        
        // Delay para não sobrecarregar API
        await new Promise(r => setTimeout(r, 300));
    }
    
    // Ordenar por lucro da melhor estratégia
    results.sort((a, b) => b.bestStrategy.profit - a.bestStrategy.profit);
    
    // Exibir resultados
    console.log('\n' + '='.repeat(100));
    console.log('RANKING - MELHORES CRIPTOS E SUAS ESTRATEGIAS IDEAIS');
    console.log('='.repeat(100));
    console.log('');
    
    console.log(padRight('Rank', 5) + padRight('Cripto', 8) + padRight('Periodo', 25) + 
                padRight('Melhor Estrategia', 20) + padRight('Lucro', 12) + 
                padRight('vs HOLD', 12) + 'Recomendacao');
    console.log('-'.repeat(100));
    
    results.forEach((r, i) => {
        const vsHold = r.bestStrategy.profit - r.holdProfit;
        const vsHoldStr = vsHold >= 0 ? '+' + vsHold.toFixed(1) + '%' : vsHold.toFixed(1) + '%';
        const recommendation = getRecommendation(r);
        
        console.log(
            padRight((i+1).toString(), 5) +
            padRight(r.symbol, 8) +
            padRight(r.period, 25) +
            padRight(r.bestStrategy.name, 20) +
            padRight((r.bestStrategy.profit >= 0 ? '+' : '') + r.bestStrategy.profit.toFixed(1) + '%', 12) +
            padRight(vsHoldStr, 12) +
            recommendation
        );
    });
    
    // Resumo por estratégia
    console.log('\n' + '='.repeat(80));
    console.log('RESUMO - QUAL ESTRATEGIA VENCE MAIS');
    console.log('='.repeat(80));
    
    const strategyWins = {};
    STRATEGIES.forEach(s => strategyWins[s.name] = 0);
    results.forEach(r => strategyWins[r.bestStrategy.name]++);
    
    Object.entries(strategyWins)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, wins]) => {
            const percent = (wins / results.length * 100).toFixed(1);
            console.log(padRight(name, 20) + ': ' + wins + ' criptos (' + percent + '%)');
        });
    
    // Análise detalhada por cripto
    console.log('\n' + '='.repeat(80));
    console.log('DETALHES POR CRIPTOMOEDA');
    console.log('='.repeat(80));
    
    results.forEach(r => {
        console.log('\n>>> ' + r.symbol + ' <<<');
        console.log('Periodo: ' + r.period + ' (' + r.days + ' dias)');
        console.log('Preco: $' + r.startPrice.toFixed(2) + ' -> $' + r.endPrice.toFixed(2));
        console.log('');
        console.log('Comparacao de estrategias:');
        
        r.strategies.sort((a, b) => b.profit - a.profit);
        r.strategies.forEach((s, i) => {
            const marker = s.name === r.bestStrategy.name ? ' <-- MELHOR' : '';
            console.log('  ' + (i+1) + '. ' + padRight(s.name, 18) + ': ' + 
                       padRight((s.profit >= 0 ? '+' : '') + s.profit.toFixed(2) + '%', 12) +
                       '(' + s.trades + ' trades)' + marker);
        });
        
        console.log('');
        console.log('RECOMENDACAO: ' + getDetailedRecommendation(r));
    });
    
    // Salvar resultados em JSON
    const fs = require('fs');
    fs.writeFileSync('crypto-analysis-results.json', JSON.stringify(results, null, 2));
    console.log('\n\nResultados salvos em crypto-analysis-results.json');
}

async function analyzeCrypto(symbol, fngMap) {
    // Buscar historico de precos
    const allKlines = [];
    let startTime = new Date('2017-01-01').getTime();
    const endTime = Date.now();
    
    while (startTime < endTime) {
        const response = await axios.get('https://api.binance.com/api/v3/klines', {
            params: {
                symbol: symbol + 'USDT',
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
    
    if (allKlines.length < 100) return null;
    
    // Filtrar apenas dias com F&G
    const prices = allKlines
        .map(k => ({
            date: new Date(k[0]).toISOString().split('T')[0],
            close: parseFloat(k[4])
        }))
        .filter(p => fngMap[p.date] !== undefined);
    
    if (prices.length < 50) return null;
    
    const startPrice = prices[0].close;
    const endPrice = prices[prices.length - 1].close;
    
    // Testar todas as estrategias
    const strategyResults = [];
    
    for (const strategy of STRATEGIES) {
        const result = simulateStrategy(prices, fngMap, 100, strategy);
        strategyResults.push({
            name: strategy.name,
            desc: strategy.desc,
            profit: result.profit,
            finalValue: result.finalValue,
            trades: result.trades
        });
    }
    
    // Encontrar melhor estrategia
    const bestStrategy = strategyResults.reduce((best, current) => 
        current.profit > best.profit ? current : best
    );
    
    const holdResult = strategyResults.find(s => s.name === 'HOLD');
    
    return {
        symbol,
        period: prices[0].date + ' a ' + prices[prices.length-1].date,
        days: prices.length,
        startPrice,
        endPrice,
        priceChange: ((endPrice - startPrice) / startPrice) * 100,
        strategies: strategyResults,
        bestStrategy,
        holdProfit: holdResult.profit
    };
}

function simulateStrategy(prices, fngMap, initial, strategy) {
    if (strategy.name === 'HOLD') {
        const finalValue = initial / prices[0].close * prices[prices.length-1].close;
        return {
            finalValue,
            profit: (finalValue - initial) / initial * 100,
            trades: 1
        };
    }
    
    let cash = initial;
    let crypto = 0;
    let trades = 0;
    
    for (const p of prices) {
        const fng = fngMap[p.date];
        
        if (fng <= strategy.buyAt && cash > 0) {
            crypto = cash / p.close;
            cash = 0;
            trades++;
        }
        
        if (fng >= strategy.sellAt && crypto > 0) {
            cash = crypto * p.close;
            crypto = 0;
            trades++;
        }
    }
    
    const finalValue = cash + crypto * prices[prices.length-1].close;
    return {
        finalValue,
        profit: (finalValue - initial) / initial * 100,
        trades
    };
}

function getRecommendation(r) {
    if (r.bestStrategy.name === 'HOLD') {
        return 'SEGURAR - Nao vender';
    } else if (r.bestStrategy.profit > r.holdProfit * 1.5) {
        return 'TRADING ATIVO - ' + r.bestStrategy.desc;
    } else if (r.bestStrategy.profit > r.holdProfit) {
        return 'Trading leve - ' + r.bestStrategy.desc;
    } else {
        return 'SEGURAR preferivel';
    }
}

function getDetailedRecommendation(r) {
    const best = r.bestStrategy;
    const hold = r.holdProfit;
    
    if (best.name === 'HOLD') {
        return 'Para ' + r.symbol + ', a melhor estrategia e simplesmente COMPRAR E SEGURAR. ' +
               'Estrategias de trading nao conseguiram superar o hold historicamente.';
    }
    
    if (best.profit < 0) {
        return 'CUIDADO! ' + r.symbol + ' nao foi lucrativo em nenhuma estrategia no periodo analisado. ' +
               'A melhor opcao foi ' + best.name + ' com ' + best.profit.toFixed(1) + '% de resultado.';
    }
    
    if (best.profit > hold) {
        const diff = best.profit - hold;
        return 'Para ' + r.symbol + ', a estrategia ' + best.name + ' superou o HOLD em ' + diff.toFixed(1) + '%. ' +
               'Recomendado: ' + best.desc + '.';
    }
    
    return 'Para ' + r.symbol + ', o HOLD teve resultado similar. ' +
           'Se preferir trading ativo, use ' + best.name + '.';
}

function padRight(str, len) {
    return (str + ' '.repeat(len)).substring(0, len);
}

analyzeAllCryptos().catch(console.error);
