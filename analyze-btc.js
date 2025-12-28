const axios = require('axios');

async function analyze() {
    console.log('=== ANÁLISE DETALHADA BTC - Estratégia Medo & Ganância ===\n');
    
    // Buscar histórico de preços do BTC
    const allKlines = [];
    let startTime = new Date('2017-01-01').getTime();
    const endTime = Date.now();
    
    console.log('Buscando histórico de preços do BTC...');
    while (startTime < endTime) {
        const response = await axios.get('https://api.binance.com/api/v3/klines', {
            params: {
                symbol: 'BTCUSDT',
                interval: '1d',
                startTime: startTime,
                limit: 1000
            }
        });
        if (response.data.length === 0) break;
        allKlines.push(...response.data);
        startTime = response.data[response.data.length - 1][0] + 86400000;
        if (response.data.length < 1000) break;
    }
    
    console.log('Total de dias de dados:', allKlines.length);
    console.log('Primeiro dia:', new Date(allKlines[0][0]).toISOString().split('T')[0]);
    console.log('Ultimo dia:', new Date(allKlines[allKlines.length-1][0]).toISOString().split('T')[0]);
    console.log('Preco inicial BTC:', parseFloat(allKlines[0][4]).toFixed(2));
    console.log('Preco atual BTC:', parseFloat(allKlines[allKlines.length-1][4]).toFixed(2));
    
    // Buscar Fear & Greed histórico
    console.log('\nBuscando historico Fear & Greed...');
    const fngResponse = await axios.get('https://api.alternative.me/fng/?limit=0');
    const fngData = fngResponse.data.data;
    console.log('Total de dias F&G:', fngData.length);
    
    // Criar mapa de F&G por data
    const fngMap = {};
    fngData.forEach(f => {
        const date = new Date(parseInt(f.timestamp) * 1000).toISOString().split('T')[0];
        fngMap[date] = parseInt(f.value);
    });
    
    // Primeira e última data com F&G
    const fngDates = Object.keys(fngMap).sort();
    console.log('Primeiro dia com F&G:', fngDates[0]);
    console.log('Ultimo dia com F&G:', fngDates[fngDates.length-1]);
    
    // Simulação
    console.log('\n' + '='.repeat(60));
    console.log('SIMULACAO COM $100');
    console.log('Estrategia: Comprar quando F&G <= 40, Vender quando F&G >= 75');
    console.log('='.repeat(60) + '\n');
    
    let cash = 100;
    let btc = 0;
    let trades = [];
    
    const prices = allKlines.map(k => ({
        date: new Date(k[0]).toISOString().split('T')[0],
        close: parseFloat(k[4])
    }));
    
    // Encontrar primeiro dia com dados de F&G
    let firstFngDate = null;
    let firstFngPrice = null;
    
    for (const price of prices) {
        const fng = fngMap[price.date];
        if (fng === undefined) continue;
        
        if (!firstFngDate) {
            firstFngDate = price.date;
            firstFngPrice = price.close;
            console.log('Primeiro dia com dados F&G: ' + firstFngDate + ' - Preco: $' + firstFngPrice.toFixed(2) + ' - F&G: ' + fng);
        }
        
        // COMPRA no medo (F&G <= 40)
        if (fng <= 40 && cash > 0) {
            const btcBought = cash / price.close;
            btc += btcBought;
            trades.push({
                date: price.date,
                type: 'BUY',
                price: price.close,
                fng: fng,
                btcAmount: btcBought,
                cashAmount: cash
            });
            cash = 0;
        }
        
        // VENDA na ganância extrema (F&G >= 75)
        if (fng >= 75 && btc > 0) {
            const cashReceived = btc * price.close;
            trades.push({
                date: price.date,
                type: 'SELL',
                price: price.close,
                fng: fng,
                btcAmount: btc,
                cashAmount: cashReceived
            });
            cash = cashReceived;
            btc = 0;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('HISTORICO DE TRADES (' + trades.length + ' operacoes)');
    console.log('='.repeat(60));
    
    let runningCash = 100;
    let runningBtc = 0;
    
    trades.forEach((t, i) => {
        if (t.type === 'BUY') {
            console.log('\n' + (i+1) + '. COMPRA em ' + t.date);
            console.log('   F&G: ' + t.fng + ' (MEDO)');
            console.log('   Preco BTC: $' + t.price.toFixed(2));
            console.log('   Gastou: $' + t.cashAmount.toFixed(2));
            console.log('   Comprou: ' + t.btcAmount.toFixed(8) + ' BTC');
            runningCash = 0;
            runningBtc = t.btcAmount;
        } else {
            const profit = t.cashAmount - 100;
            const profitPercent = (profit / 100 * 100).toFixed(2);
            console.log('\n' + (i+1) + '. VENDA em ' + t.date);
            console.log('   F&G: ' + t.fng + ' (GANANCIA)');
            console.log('   Preco BTC: $' + t.price.toFixed(2));
            console.log('   Vendeu: ' + t.btcAmount.toFixed(8) + ' BTC');
            console.log('   Recebeu: $' + t.cashAmount.toFixed(2));
            console.log('   Lucro acumulado: $' + profit.toFixed(2) + ' (' + profitPercent + '%)');
            runningCash = t.cashAmount;
            runningBtc = 0;
        }
    });
    
    const finalPrice = prices[prices.length-1].close;
    const finalValue = cash + (btc * finalPrice);
    const holdValue = 100 / firstFngPrice * finalPrice;
    
    console.log('\n' + '='.repeat(60));
    console.log('RESULTADO FINAL');
    console.log('='.repeat(60));
    console.log('\nInvestimento inicial: $100.00');
    console.log('Periodo: ' + firstFngDate + ' ate ' + prices[prices.length-1].date);
    console.log('\n--- ESTRATEGIA MEDO & GANANCIA ---');
    console.log('Cash atual: $' + cash.toFixed(2));
    console.log('BTC atual: ' + btc.toFixed(8));
    if (btc > 0) {
        console.log('Valor do BTC hoje ($' + finalPrice.toFixed(2) + '): $' + (btc * finalPrice).toFixed(2));
    }
    console.log('VALOR TOTAL: $' + finalValue.toFixed(2));
    console.log('LUCRO: $' + (finalValue - 100).toFixed(2) + ' (' + ((finalValue - 100) / 100 * 100).toFixed(2) + '%)');
    
    console.log('\n--- BUY & HOLD (so segurar) ---');
    console.log('Se tivesse comprado $100 em ' + firstFngDate + ' a $' + firstFngPrice.toFixed(2));
    console.log('Teria: ' + (100 / firstFngPrice).toFixed(8) + ' BTC');
    console.log('Valor hoje: $' + holdValue.toFixed(2));
    console.log('LUCRO HOLD: $' + (holdValue - 100).toFixed(2) + ' (' + ((holdValue - 100) / 100 * 100).toFixed(2) + '%)');
    
    console.log('\n--- COMPARACAO ---');
    if (finalValue > holdValue) {
        console.log('ESTRATEGIA VENCEU! Ganhou $' + (finalValue - holdValue).toFixed(2) + ' a mais que o Hold');
    } else {
        console.log('HOLD VENCEU! Ganhou $' + (holdValue - finalValue).toFixed(2) + ' a mais que a estrategia');
    }
    
    // Análise adicional: mostrar momentos de medo e ganância
    console.log('\n' + '='.repeat(60));
    console.log('ANALISE DOS MOMENTOS DE MEDO E GANANCIA');
    console.log('='.repeat(60));
    
    let fearDays = 0;
    let greedDays = 0;
    let extremeFearDays = 0;
    let extremeGreedDays = 0;
    
    for (const date of fngDates) {
        const fng = fngMap[date];
        if (fng <= 20) extremeFearDays++;
        else if (fng <= 40) fearDays++;
        else if (fng >= 80) extremeGreedDays++;
        else if (fng >= 75) greedDays++;
    }
    
    console.log('Dias com Medo Extremo (F&G <= 20): ' + extremeFearDays);
    console.log('Dias com Medo (F&G 21-40): ' + fearDays);
    console.log('Dias com Ganancia Alta (F&G 75-79): ' + greedDays);
    console.log('Dias com Ganancia Extrema (F&G >= 80): ' + extremeGreedDays);
}

analyze().catch(console.error);
