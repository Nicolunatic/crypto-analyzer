const axios = require('axios');

// ESTRATÉGIAS DE MERCADO PARA TESTAR
const STRATEGIES = [
    // 1. HOLD - Baseline
    { 
        name: 'HOLD', 
        desc: 'Comprar e segurar para sempre',
        type: 'hold'
    },
    
    // 2. DCA - Dollar Cost Averaging (Aportes mensais)
    { 
        name: 'DCA Mensal', 
        desc: 'Investir valor fixo todo mes, independente do preco',
        type: 'dca',
        interval: 30
    },
    
    // 3. DCA Semanal
    { 
        name: 'DCA Semanal', 
        desc: 'Investir valor fixo toda semana',
        type: 'dca',
        interval: 7
    },
    
    // 4. Buy the Dip - Comprar nas quedas
    { 
        name: 'Buy the Dip -10%', 
        desc: 'Comprar quando cai 10% do topo recente',
        type: 'buydip',
        dipPercent: 10
    },
    
    // 5. Buy the Dip forte
    { 
        name: 'Buy the Dip -20%', 
        desc: 'Comprar quando cai 20% do topo recente',
        type: 'buydip',
        dipPercent: 20
    },
    
    // 6. Buy the Dip extremo
    { 
        name: 'Buy the Dip -30%', 
        desc: 'Comprar quando cai 30% do topo recente',
        type: 'buydip',
        dipPercent: 30
    },
    
    // 7. Media Movel 50 dias
    { 
        name: 'MA50 CrossOver', 
        desc: 'Comprar acima da MA50, vender abaixo',
        type: 'ma',
        period: 50
    },
    
    // 8. Media Movel 200 dias (Golden Cross)
    { 
        name: 'MA200 CrossOver', 
        desc: 'Comprar acima da MA200, vender abaixo',
        type: 'ma',
        period: 200
    },
    
    // 9. RSI Strategy
    { 
        name: 'RSI (30/70)', 
        desc: 'Comprar RSI<30 (sobrevendido), vender RSI>70 (sobrecomprado)',
        type: 'rsi',
        buyLevel: 30,
        sellLevel: 70
    },
    
    // 10. RSI Extremo
    { 
        name: 'RSI (20/80)', 
        desc: 'Comprar RSI<20, vender RSI>80 (mais conservador)',
        type: 'rsi',
        buyLevel: 20,
        sellLevel: 80
    },
    
    // 11. Fear & Greed Original
    { 
        name: 'F&G (40/75)', 
        desc: 'Comprar medo <=40, vender ganancia >=75',
        type: 'fng',
        buyLevel: 40,
        sellLevel: 75
    },
    
    // 12. Fear & Greed Conservador
    { 
        name: 'F&G (25/80)', 
        desc: 'Comprar medo <=25, vender ganancia >=80',
        type: 'fng',
        buyLevel: 25,
        sellLevel: 80
    },
    
    // 13. Fear & Greed Extremo
    { 
        name: 'F&G (20/90)', 
        desc: 'Comprar medo extremo <=20, vender ganancia extrema >=90',
        type: 'fng',
        buyLevel: 20,
        sellLevel: 90
    },
    
    // 14. Combinado: F&G + DCA no medo
    { 
        name: 'DCA no Medo', 
        desc: 'DCA apenas quando F&G <= 40',
        type: 'dca_fng',
        fngLevel: 40,
        interval: 7
    },
    
    // 15. Rebalanceamento
    { 
        name: 'Rebalance 50/50', 
        desc: 'Manter 50% crypto 50% cash, rebalancear mensalmente',
        type: 'rebalance',
        targetPercent: 50,
        interval: 30
    },
    
    // 16. Take Profit parcial
    { 
        name: 'Take Profit +50%', 
        desc: 'Vender 25% quando lucro atinge 50%',
        type: 'takeprofit',
        profitTarget: 50,
        sellPercent: 25
    },
    
    // 17. Trailing Stop
    { 
        name: 'Trailing Stop -15%', 
        desc: 'Vender tudo se cair 15% do topo',
        type: 'trailingstop',
        stopPercent: 15
    },
    
    // 18. Accumulate & Hold
    { 
        name: 'Acumular no Bear', 
        desc: 'DCA quando preco abaixo da MA200, hold quando acima',
        type: 'accumulate_bear'
    },
];

async function runFullAnalysis() {
    console.log('='.repeat(100));
    console.log('ANALISE COMPLETA: ESTRATEGIAS DE MERCADO vs HOLD');
    console.log('='.repeat(100));
    console.log('');
    
    // Buscar F&G
    console.log('Carregando dados Fear & Greed...');
    const fngResponse = await axios.get('https://api.alternative.me/fng/?limit=0');
    const fngMap = {};
    fngResponse.data.data.forEach(f => {
        const date = new Date(parseInt(f.timestamp) * 1000).toISOString().split('T')[0];
        fngMap[date] = parseInt(f.value);
    });
    
    // Criptos para testar
    const cryptos = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'DOT'];
    
    const allResults = {};
    
    for (const symbol of cryptos) {
        console.log(`\nAnalisando ${symbol}...`);
        
        try {
            const prices = await fetchPrices(symbol);
            if (prices.length < 200) {
                console.log(`  ${symbol}: Dados insuficientes`);
                continue;
            }
            
            const results = [];
            
            for (const strategy of STRATEGIES) {
                const result = runStrategy(prices, fngMap, strategy, 10000);
                results.push({
                    name: strategy.name,
                    desc: strategy.desc,
                    ...result
                });
            }
            
            // Ordenar por lucro
            results.sort((a, b) => b.profit - a.profit);
            allResults[symbol] = results;
            
            // Mostrar top 5
            console.log(`  Top estrategias para ${symbol}:`);
            results.slice(0, 5).forEach((r, i) => {
                const icon = r.profit > 0 ? '✓' : '✗';
                console.log(`    ${i+1}. ${r.name}: ${r.profit >= 0 ? '+' : ''}${r.profit.toFixed(1)}% (${r.trades} trades) ${icon}`);
            });
            
        } catch (error) {
            console.log(`  ${symbol}: Erro - ${error.message}`);
        }
        
        await sleep(500);
    }
    
    // RESUMO GERAL
    console.log('\n' + '='.repeat(100));
    console.log('RESUMO GERAL - QUAL ESTRATEGIA VENCE MAIS?');
    console.log('='.repeat(100));
    
    const strategyWins = {};
    const strategyAvgProfit = {};
    const strategyBeatHold = {};
    
    STRATEGIES.forEach(s => {
        strategyWins[s.name] = 0;
        strategyAvgProfit[s.name] = [];
        strategyBeatHold[s.name] = 0;
    });
    
    Object.entries(allResults).forEach(([symbol, results]) => {
        // Quem venceu
        strategyWins[results[0].name]++;
        
        // Lucro medio de cada estrategia
        const holdProfit = results.find(r => r.name === 'HOLD')?.profit || 0;
        
        results.forEach(r => {
            strategyAvgProfit[r.name].push(r.profit);
            if (r.profit > holdProfit && r.name !== 'HOLD') {
                strategyBeatHold[r.name]++;
            }
        });
    });
    
    // Calcular medias
    const summaryData = STRATEGIES.map(s => ({
        name: s.name,
        desc: s.desc,
        wins: strategyWins[s.name],
        avgProfit: strategyAvgProfit[s.name].length > 0 
            ? strategyAvgProfit[s.name].reduce((a,b) => a+b, 0) / strategyAvgProfit[s.name].length 
            : 0,
        beatHold: strategyBeatHold[s.name]
    }));
    
    // Ordenar por media de lucro
    summaryData.sort((a, b) => b.avgProfit - a.avgProfit);
    
    console.log('\nRANKING POR LUCRO MEDIO:\n');
    console.log(padRight('Rank', 5) + padRight('Estrategia', 22) + padRight('Lucro Medio', 14) + 
                padRight('Vitorias', 10) + padRight('Bateu HOLD', 12) + 'Descricao');
    console.log('-'.repeat(100));
    
    summaryData.forEach((s, i) => {
        const profitStr = (s.avgProfit >= 0 ? '+' : '') + s.avgProfit.toFixed(1) + '%';
        const beatStr = s.name === 'HOLD' ? '-' : s.beatHold + '/' + Object.keys(allResults).length;
        console.log(
            padRight((i+1).toString(), 5) +
            padRight(s.name, 22) +
            padRight(profitStr, 14) +
            padRight(s.wins.toString(), 10) +
            padRight(beatStr, 12) +
            s.desc
        );
    });
    
    // ANALISE DETALHADA POR CRIPTO
    console.log('\n' + '='.repeat(100));
    console.log('MELHOR ESTRATEGIA POR CRIPTOMOEDA');
    console.log('='.repeat(100) + '\n');
    
    Object.entries(allResults).forEach(([symbol, results]) => {
        const best = results[0];
        const hold = results.find(r => r.name === 'HOLD');
        const diff = best.profit - hold.profit;
        const icon = best.name === 'HOLD' ? '🔒' : '📈';
        
        console.log(`${icon} ${symbol}: ${best.name} (${best.profit >= 0 ? '+' : ''}${best.profit.toFixed(1)}%)` +
                   (best.name !== 'HOLD' ? ` - Bateu HOLD por ${diff.toFixed(1)}%` : ' - HOLD foi melhor'));
    });
    
    // CONCLUSAO
    console.log('\n' + '='.repeat(100));
    console.log('CONCLUSAO FINAL');
    console.log('='.repeat(100));
    
    const holdRank = summaryData.findIndex(s => s.name === 'HOLD') + 1;
    const bestStrategy = summaryData[0];
    
    console.log(`\n1. HOLD ficou em ${holdRank}o lugar no ranking geral`);
    console.log(`2. Melhor estrategia geral: ${bestStrategy.name} com media de ${bestStrategy.avgProfit.toFixed(1)}%`);
    console.log(`3. Estrategias que bateram HOLD mais vezes:`);
    
    summaryData
        .filter(s => s.beatHold > 0)
        .sort((a, b) => b.beatHold - a.beatHold)
        .slice(0, 5)
        .forEach(s => {
            console.log(`   - ${s.name}: ${s.beatHold}/${Object.keys(allResults).length} criptos`);
        });
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
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
    }));
}

function runStrategy(prices, fngMap, strategy, initialCash) {
    switch (strategy.type) {
        case 'hold':
            return strategyHold(prices, initialCash);
        case 'dca':
            return strategyDCA(prices, initialCash, strategy.interval);
        case 'buydip':
            return strategyBuyDip(prices, initialCash, strategy.dipPercent);
        case 'ma':
            return strategyMA(prices, initialCash, strategy.period);
        case 'rsi':
            return strategyRSI(prices, initialCash, strategy.buyLevel, strategy.sellLevel);
        case 'fng':
            return strategyFNG(prices, fngMap, initialCash, strategy.buyLevel, strategy.sellLevel);
        case 'dca_fng':
            return strategyDCAFNG(prices, fngMap, initialCash, strategy.fngLevel, strategy.interval);
        case 'rebalance':
            return strategyRebalance(prices, initialCash, strategy.targetPercent, strategy.interval);
        case 'takeprofit':
            return strategyTakeProfit(prices, initialCash, strategy.profitTarget, strategy.sellPercent);
        case 'trailingstop':
            return strategyTrailingStop(prices, initialCash, strategy.stopPercent);
        case 'accumulate_bear':
            return strategyAccumulateBear(prices, initialCash);
        default:
            return { finalValue: initialCash, profit: 0, trades: 0 };
    }
}

// ESTRATEGIA 1: HOLD
function strategyHold(prices, initial) {
    const crypto = initial / prices[0].close;
    const finalValue = crypto * prices[prices.length - 1].close;
    return {
        finalValue,
        profit: (finalValue - initial) / initial * 100,
        trades: 1
    };
}

// ESTRATEGIA 2: DCA
function strategyDCA(prices, initial, interval) {
    const investPerPeriod = initial / Math.floor(prices.length / interval);
    let crypto = 0;
    let totalInvested = 0;
    let trades = 0;
    
    for (let i = 0; i < prices.length; i += interval) {
        if (totalInvested + investPerPeriod <= initial) {
            crypto += investPerPeriod / prices[i].close;
            totalInvested += investPerPeriod;
            trades++;
        }
    }
    
    const finalValue = crypto * prices[prices.length - 1].close;
    return {
        finalValue,
        profit: (finalValue - totalInvested) / totalInvested * 100,
        trades
    };
}

// ESTRATEGIA 3: Buy the Dip
function strategyBuyDip(prices, initial, dipPercent) {
    let cash = initial;
    let crypto = 0;
    let trades = 0;
    let athPrice = prices[0].close;
    const investPerDip = initial / 10; // Divide em 10 compras
    
    for (const p of prices) {
        if (p.close > athPrice) athPrice = p.close;
        
        const dropPercent = ((athPrice - p.close) / athPrice) * 100;
        
        if (dropPercent >= dipPercent && cash >= investPerDip) {
            crypto += investPerDip / p.close;
            cash -= investPerDip;
            trades++;
            athPrice = p.close; // Reset ATH para evitar multiplas compras no mesmo dip
        }
    }
    
    const finalValue = cash + crypto * prices[prices.length - 1].close;
    return {
        finalValue,
        profit: (finalValue - initial) / initial * 100,
        trades
    };
}

// ESTRATEGIA 4: Media Movel
function strategyMA(prices, initial, period) {
    let cash = initial;
    let crypto = 0;
    let trades = 0;
    
    for (let i = period; i < prices.length; i++) {
        const ma = prices.slice(i - period, i).reduce((s, p) => s + p.close, 0) / period;
        const price = prices[i].close;
        
        // Comprar quando preco cruza acima da MA
        if (price > ma && cash > 0) {
            crypto = cash / price;
            cash = 0;
            trades++;
        }
        // Vender quando preco cruza abaixo da MA
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

// ESTRATEGIA 5: RSI
function strategyRSI(prices, initial, buyLevel, sellLevel) {
    let cash = initial;
    let crypto = 0;
    let trades = 0;
    const period = 14;
    
    for (let i = period; i < prices.length; i++) {
        const rsi = calculateRSI(prices.slice(i - period, i + 1));
        const price = prices[i].close;
        
        if (rsi < buyLevel && cash > 0) {
            crypto = cash / price;
            cash = 0;
            trades++;
        } else if (rsi > sellLevel && crypto > 0) {
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

function calculateRSI(prices) {
    let gains = 0, losses = 0;
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i].close - prices[i-1].close;
        if (change > 0) gains += change;
        else losses -= change;
    }
    const avgGain = gains / (prices.length - 1);
    const avgLoss = losses / (prices.length - 1);
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// ESTRATEGIA 6: Fear & Greed
function strategyFNG(prices, fngMap, initial, buyLevel, sellLevel) {
    let cash = initial;
    let crypto = 0;
    let trades = 0;
    
    for (const p of prices) {
        const fng = fngMap[p.date];
        if (fng === undefined) continue;
        
        if (fng <= buyLevel && cash > 0) {
            crypto = cash / p.close;
            cash = 0;
            trades++;
        } else if (fng >= sellLevel && crypto > 0) {
            cash = crypto * p.close;
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

// ESTRATEGIA 7: DCA apenas no medo
function strategyDCAFNG(prices, fngMap, initial, fngLevel, interval) {
    let cash = initial;
    let crypto = 0;
    let trades = 0;
    const investPerBuy = initial / 20;
    let daysSinceLastBuy = interval;
    
    for (const p of prices) {
        const fng = fngMap[p.date];
        daysSinceLastBuy++;
        
        if (fng !== undefined && fng <= fngLevel && daysSinceLastBuy >= interval && cash >= investPerBuy) {
            crypto += investPerBuy / p.close;
            cash -= investPerBuy;
            trades++;
            daysSinceLastBuy = 0;
        }
    }
    
    const finalValue = cash + crypto * prices[prices.length - 1].close;
    const totalInvested = initial - cash + (crypto > 0 ? 0 : 0);
    return {
        finalValue,
        profit: totalInvested > 0 ? (finalValue - initial) / initial * 100 : 0,
        trades
    };
}

// ESTRATEGIA 8: Rebalanceamento
function strategyRebalance(prices, initial, targetPercent, interval) {
    let cash = initial * (1 - targetPercent / 100);
    let crypto = (initial * targetPercent / 100) / prices[0].close;
    let trades = 1;
    
    for (let i = interval; i < prices.length; i += interval) {
        const totalValue = cash + crypto * prices[i].close;
        const targetCrypto = (totalValue * targetPercent / 100) / prices[i].close;
        const targetCash = totalValue * (1 - targetPercent / 100);
        
        if (Math.abs(crypto - targetCrypto) / targetCrypto > 0.05) { // Rebalancear se > 5% de desvio
            crypto = targetCrypto;
            cash = targetCash;
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

// ESTRATEGIA 9: Take Profit
function strategyTakeProfit(prices, initial, profitTarget, sellPercent) {
    let cash = 0;
    let crypto = initial / prices[0].close;
    let trades = 1;
    let costBasis = prices[0].close;
    
    for (const p of prices) {
        const currentProfit = ((p.close - costBasis) / costBasis) * 100;
        
        if (currentProfit >= profitTarget && crypto > 0) {
            const sellAmount = crypto * (sellPercent / 100);
            cash += sellAmount * p.close;
            crypto -= sellAmount;
            trades++;
            costBasis = p.close; // Reset cost basis
        }
    }
    
    const finalValue = cash + crypto * prices[prices.length - 1].close;
    return {
        finalValue,
        profit: (finalValue - initial) / initial * 100,
        trades
    };
}

// ESTRATEGIA 10: Trailing Stop
function strategyTrailingStop(prices, initial, stopPercent) {
    let cash = 0;
    let crypto = initial / prices[0].close;
    let trades = 1;
    let peakPrice = prices[0].close;
    let inPosition = true;
    
    for (const p of prices) {
        if (inPosition) {
            if (p.close > peakPrice) peakPrice = p.close;
            
            const dropFromPeak = ((peakPrice - p.close) / peakPrice) * 100;
            
            if (dropFromPeak >= stopPercent) {
                cash = crypto * p.close;
                crypto = 0;
                trades++;
                inPosition = false;
            }
        } else {
            // Reentrar quando recuperar
            if (p.close > peakPrice * 0.95) {
                crypto = cash / p.close;
                cash = 0;
                trades++;
                inPosition = true;
                peakPrice = p.close;
            }
        }
    }
    
    const finalValue = cash + crypto * prices[prices.length - 1].close;
    return {
        finalValue,
        profit: (finalValue - initial) / initial * 100,
        trades
    };
}

// ESTRATEGIA 11: Acumular no Bear Market
function strategyAccumulateBear(prices, initial) {
    let cash = initial;
    let crypto = 0;
    let trades = 0;
    const investPerBuy = initial / 20;
    const ma200Period = 200;
    
    for (let i = ma200Period; i < prices.length; i++) {
        const ma200 = prices.slice(i - ma200Period, i).reduce((s, p) => s + p.close, 0) / ma200Period;
        const price = prices[i].close;
        
        // Acumular quando abaixo da MA200 (bear market)
        if (price < ma200 && cash >= investPerBuy) {
            crypto += investPerBuy / price;
            cash -= investPerBuy;
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

runFullAnalysis().catch(console.error);
