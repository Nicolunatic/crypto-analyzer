const axios = require('axios');

async function analyzeStrategies() {
    console.log('=== COMPARACAO DE ESTRATEGIAS BTC ===\n');
    
    // Buscar dados
    const allKlines = [];
    let startTime = new Date('2017-01-01').getTime();
    const endTime = Date.now();
    
    console.log('Buscando dados...');
    while (startTime < endTime) {
        const response = await axios.get('https://api.binance.com/api/v3/klines', {
            params: { symbol: 'BTCUSDT', interval: '1d', startTime, limit: 1000 }
        });
        if (response.data.length === 0) break;
        allKlines.push(...response.data);
        startTime = response.data[response.data.length - 1][0] + 86400000;
        if (response.data.length < 1000) break;
    }
    
    const fngResponse = await axios.get('https://api.alternative.me/fng/?limit=0');
    const fngMap = {};
    fngResponse.data.data.forEach(f => {
        const date = new Date(parseInt(f.timestamp) * 1000).toISOString().split('T')[0];
        fngMap[date] = parseInt(f.value);
    });
    
    const prices = allKlines.map(k => ({
        date: new Date(k[0]).toISOString().split('T')[0],
        close: parseFloat(k[4])
    })).filter(p => fngMap[p.date] !== undefined);
    
    console.log('Periodo: ' + prices[0].date + ' a ' + prices[prices.length-1].date);
    console.log('Dias analisados: ' + prices.length);
    console.log('');
    
    // Testar diferentes estratégias
    const strategies = [
        { name: 'Medo <=25, Ganancia >=80', buyAt: 25, sellAt: 80 },
        { name: 'Medo <=30, Ganancia >=80', buyAt: 30, sellAt: 80 },
        { name: 'Medo <=40, Ganancia >=75 (atual)', buyAt: 40, sellAt: 75 },
        { name: 'Medo <=40, Ganancia >=80', buyAt: 40, sellAt: 80 },
        { name: 'Medo <=20 (extremo), Ganancia >=90', buyAt: 20, sellAt: 90 },
        { name: 'So Medo Extremo <=15, Ganancia >=85', buyAt: 15, sellAt: 85 },
    ];
    
    const firstPrice = prices[0].close;
    const lastPrice = prices[prices.length-1].close;
    const holdValue = 100 / firstPrice * lastPrice;
    
    console.log('='.repeat(80));
    console.log('HOLD (so comprar e segurar): $100 -> $' + holdValue.toFixed(2) + ' (+' + ((holdValue-100)/100*100).toFixed(2) + '%)');
    console.log('='.repeat(80));
    console.log('');
    
    for (const strategy of strategies) {
        const result = simulate(prices, fngMap, 100, strategy.buyAt, strategy.sellAt);
        const status = result.finalValue > 100 ? 'LUCRO' : 'PREJUIZO';
        const vsBuy = result.finalValue > holdValue ? 'MELHOR que Hold' : 'PIOR que Hold';
        
        console.log('Estrategia: ' + strategy.name);
        console.log('  Trades: ' + result.trades + ' (' + result.buys + ' compras, ' + result.sells + ' vendas)');
        console.log('  Resultado: $100 -> $' + result.finalValue.toFixed(2) + ' (' + (result.profit >= 0 ? '+' : '') + result.profit.toFixed(2) + '%)');
        console.log('  Status: ' + status + ' | ' + vsBuy);
        console.log('');
    }
    
    // Estratégia melhorada: DCA no medo + vender parcial na ganância
    console.log('='.repeat(80));
    console.log('ESTRATEGIA MELHORADA: DCA no medo, venda parcial na ganancia extrema');
    console.log('='.repeat(80));
    
    const dcaResult = simulateDCA(prices, fngMap, 100);
    console.log('');
    console.log('Detalhes:');
    console.log('  - Compra 25% do cash quando F&G <= 25 (medo extremo)');
    console.log('  - Compra 10% do cash quando F&G <= 40 (medo)');
    console.log('  - Vende 25% do BTC quando F&G >= 80 (ganancia)');
    console.log('  - Vende 50% do BTC quando F&G >= 90 (ganancia extrema)');
    console.log('');
    console.log('  Trades totais: ' + dcaResult.trades);
    console.log('  Resultado: $100 -> $' + dcaResult.finalValue.toFixed(2) + ' (' + (dcaResult.profit >= 0 ? '+' : '') + dcaResult.profit.toFixed(2) + '%)');
    console.log('  Cash final: $' + dcaResult.cash.toFixed(2));
    console.log('  BTC final: ' + dcaResult.btc.toFixed(8) + ' (= $' + (dcaResult.btc * lastPrice).toFixed(2) + ')');
}

function simulate(prices, fngMap, initial, buyThreshold, sellThreshold) {
    let cash = initial;
    let btc = 0;
    let buys = 0;
    let sells = 0;
    
    for (const p of prices) {
        const fng = fngMap[p.date];
        
        if (fng <= buyThreshold && cash > 0) {
            btc = cash / p.close;
            cash = 0;
            buys++;
        }
        
        if (fng >= sellThreshold && btc > 0) {
            cash = btc * p.close;
            btc = 0;
            sells++;
        }
    }
    
    const finalValue = cash + btc * prices[prices.length-1].close;
    return {
        finalValue,
        profit: (finalValue - initial) / initial * 100,
        trades: buys + sells,
        buys,
        sells
    };
}

function simulateDCA(prices, fngMap, initial) {
    let cash = initial;
    let btc = 0;
    let trades = 0;
    let lastBuyFng = 100; // Para evitar comprar todos os dias
    let lastSellFng = 0;
    
    for (const p of prices) {
        const fng = fngMap[p.date];
        
        // Compra 25% do cash no medo extremo
        if (fng <= 25 && cash > 10 && lastBuyFng > 30) {
            const buyAmount = cash * 0.25;
            btc += buyAmount / p.close;
            cash -= buyAmount;
            trades++;
            lastBuyFng = fng;
        }
        // Compra 10% do cash no medo
        else if (fng <= 40 && fng > 25 && cash > 10 && lastBuyFng > 45) {
            const buyAmount = cash * 0.10;
            btc += buyAmount / p.close;
            cash -= buyAmount;
            trades++;
            lastBuyFng = fng;
        }
        
        // Vende 50% na ganância extrema
        if (fng >= 90 && btc > 0.00001 && lastSellFng < 85) {
            const sellAmount = btc * 0.50;
            cash += sellAmount * p.close;
            btc -= sellAmount;
            trades++;
            lastSellFng = fng;
        }
        // Vende 25% na ganância alta
        else if (fng >= 80 && fng < 90 && btc > 0.00001 && lastSellFng < 75) {
            const sellAmount = btc * 0.25;
            cash += sellAmount * p.close;
            btc -= sellAmount;
            trades++;
            lastSellFng = fng;
        }
        
        // Reset dos controles quando sai da zona
        if (fng > 50) lastBuyFng = 100;
        if (fng < 70) lastSellFng = 0;
    }
    
    const lastPrice = prices[prices.length-1].close;
    const finalValue = cash + btc * lastPrice;
    
    return {
        finalValue,
        profit: (finalValue - initial) / initial * 100,
        trades,
        cash,
        btc
    };
}

analyzeStrategies().catch(console.error);
