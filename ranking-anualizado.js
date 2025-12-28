const axios = require('axios');

// Todas as criptos para analisar
const TODAS_CRYPTOS = [
    'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC',
    'UNI', 'LTC', 'NEAR', 'INJ', 'AAVE', 'FIL', 'FET', 'VET', 'ALGO', 'XLM',
    'DOGE', 'TRX', 'ETC', 'HBAR', 'SUI', 'PENDLE', 'SEI', 'RUNE', 'GRT', 'THETA'
];

async function getFullHistory(symbol) {
    let allData = [];
    let startTime = new Date('2017-01-01').getTime();
    
    while (startTime < Date.now()) {
        const r = await axios.get('https://api.binance.com/api/v3/klines', {
            params: { symbol: symbol + 'USDT', interval: '1d', startTime, limit: 1000 }
        });
        if (r.data.length === 0) break;
        allData = allData.concat(r.data);
        startTime = r.data[r.data.length - 1][0] + 86400000;
        await new Promise(r => setTimeout(r, 30));
    }
    return allData;
}

async function analyze() {
    console.log('='.repeat(70));
    console.log('ANÁLISE DE RENDIMENTO ANUALIZADO - MA50 CrossOver');
    console.log('='.repeat(70));
    console.log('\nAnalisando criptos...\n');
    
    const results = [];
    
    for (const symbol of TODAS_CRYPTOS) {
        process.stdout.write(`${symbol}... `);
        try {
            const data = await getFullHistory(symbol);
            const prices = data.map(k => parseFloat(k[4]));
            const days = prices.length;
            const anos = days / 365;
            
            if (days < 100) { console.log('poucos dias'); continue; }
            
            // Simulação MA50
            let capital = 1000, pos = 0, inPos = false;
            let sum = 0;
            for (let i = 0; i < 50; i++) sum += prices[i];
            if (prices[49] > sum/50) { pos = capital/prices[49]; capital = 0; inPos = true; }
            
            for (let i = 50; i < prices.length; i++) {
                sum = 0; for (let j = i-49; j <= i; j++) sum += prices[j];
                const ma = sum/50, prev = prices[i-1], curr = prices[i];
                let ps = 0; for (let j = i-50; j < i; j++) ps += prices[j];
                const pma = ps/50;
                if (!inPos && prev <= pma && curr > ma) { pos = capital/curr; capital = 0; inPos = true; }
                else if (inPos && prev >= pma && curr < ma) { capital = pos*curr; pos = 0; inPos = false; }
            }
            
            const finalMA = inPos ? pos*prices[prices.length-1] : capital;
            const lucroTotal = ((finalMA - 1000) / 1000) * 100;
            
            // Rendimento anualizado: ((valor_final/valor_inicial)^(1/anos) - 1) * 100
            const rendAnual = (Math.pow(finalMA/1000, 1/anos) - 1) * 100;
            
            results.push({ 
                symbol, 
                dias: days, 
                anos: anos.toFixed(1), 
                lucroTotal: Math.round(lucroTotal), 
                rendAnual: Math.round(rendAnual) 
            });
            
            console.log(`✓ ${anos.toFixed(1)} anos | ${rendAnual >= 0 ? '+' : ''}${rendAnual.toFixed(0)}%/ano`);
        } catch(e) { 
            console.log('erro'); 
        }
    }
    
    // Ordenar por rendimento anualizado
    results.sort((a, b) => b.rendAnual - a.rendAnual);
    
    console.log('\n' + '='.repeat(70));
    console.log('RANKING POR RENDIMENTO ANUALIZADO (ordenado do melhor pro pior)');
    console.log('='.repeat(70));
    console.log('\nRank  Cripto   Anos    Total%     %/Ano    Avaliação');
    console.log('-'.repeat(70));
    
    results.forEach((r, i) => {
        let avaliacao = '';
        let emoji = '';
        if (r.rendAnual >= 100) { avaliacao = '🔥 EXCELENTE'; emoji = '🔥'; }
        else if (r.rendAnual >= 50) { avaliacao = '✅ BOM'; emoji = '✅'; }
        else if (r.rendAnual >= 20) { avaliacao = '⚠️  OK'; emoji = '⚠️'; }
        else { avaliacao = '❌ FRACO'; emoji = '❌'; }
        
        console.log(
            `${(i+1).toString().padStart(2)}    ${r.symbol.padEnd(8)} ${r.anos.padStart(4)}    ` +
            `${(r.lucroTotal >= 0 ? '+' : '') + r.lucroTotal.toString().padStart(7)}%   ` +
            `${(r.rendAnual >= 0 ? '+' : '') + r.rendAnual.toString().padStart(4)}%    ${avaliacao}`
        );
    });
    
    // Filtrar só os bons (>50%/ano)
    const bons = results.filter(r => r.rendAnual >= 50);
    
    console.log('\n' + '='.repeat(70));
    console.log('🏆 CRIPTOS RECOMENDADAS (rendimento > 50%/ano)');
    console.log('='.repeat(70));
    
    if (bons.length > 0) {
        console.log('\nconst TOP_PORTFOLIO = [');
        bons.forEach(r => {
            console.log(`    '${r.symbol}',  // +${r.rendAnual}%/ano | ${r.anos} anos de histórico`);
        });
        console.log('];');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('RESUMO');
    console.log('='.repeat(70));
    console.log(`Total analisadas: ${results.length}`);
    console.log(`🔥 Excelentes (>100%/ano): ${results.filter(r => r.rendAnual >= 100).length}`);
    console.log(`✅ Boas (50-100%/ano): ${results.filter(r => r.rendAnual >= 50 && r.rendAnual < 100).length}`);
    console.log(`⚠️  OK (20-50%/ano): ${results.filter(r => r.rendAnual >= 20 && r.rendAnual < 50).length}`);
    console.log(`❌ Fracas (<20%/ano): ${results.filter(r => r.rendAnual < 20).length}`);
}

analyze().catch(console.error);
