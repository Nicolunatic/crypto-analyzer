const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Cache para evitar muitas requisições
let cache = {
    fearGreed: { data: null, timestamp: 0 },
    cryptos: { data: null, timestamp: 0 },
    fearGreedHistory: { data: null, timestamp: 0 }
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// API: Índice de Medo e Ganância atual
app.get('/api/fear-greed', async (req, res) => {
    try {
        if (cache.fearGreed.data && Date.now() - cache.fearGreed.timestamp < CACHE_DURATION) {
            return res.json(cache.fearGreed.data);
        }

        const response = await axios.get('https://api.alternative.me/fng/?limit=1');
        cache.fearGreed = { data: response.data, timestamp: Date.now() };
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao buscar Fear & Greed:', error.message);
        res.status(500).json({ error: 'Erro ao buscar índice de medo e ganância' });
    }
});

// API: Histórico do índice de Medo e Ganância
app.get('/api/fear-greed/history', async (req, res) => {
    try {
        const limit = req.query.limit || 365;
        
        if (cache.fearGreedHistory.data && Date.now() - cache.fearGreedHistory.timestamp < CACHE_DURATION) {
            return res.json(cache.fearGreedHistory.data);
        }

        const response = await axios.get(`https://api.alternative.me/fng/?limit=${limit}`);
        cache.fearGreedHistory = { data: response.data, timestamp: Date.now() };
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao buscar histórico Fear & Greed:', error.message);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// 🏆 TOP 17 PORTFOLIO - Selecionadas por RENDIMENTO ANUALIZADO MA50
// Critérios: >50%/ano de lucro com MA50 CrossOver (histórico completo)
const CURATED_CRYPTOS = [
    // 🔥 EXCELENTES (>100%/ano)
    'SOL',    // +160%/ano | 5.4 anos | Solana
    'SUI',    // +131%/ano | 2.7 anos | Layer 1 rápido
    'DOGE',   // +121%/ano | 6.5 anos | Dogecoin
    'BNB',    // +108%/ano | 8.2 anos | Binance
    'FET',    // +107%/ano | 6.8 anos | Fetch.ai - IA
    // ✅ BOAS (50-100%/ano)
    'RUNE',   // +98%/ano | 5.3 anos | THORChain
    'PENDLE', // +96%/ano | 2.5 anos | DeFi Yield
    'AVAX',   // +93%/ano | 5.3 anos | Avalanche
    'SEI',    // +93%/ano | 2.4 anos | Layer 1 trading
    'VET',    // +84%/ano | 7.4 anos | VeChain
    'BTC',    // +69%/ano | 8.4 anos | Bitcoin
    'NEAR',   // +63%/ano | 5.2 anos | Near Protocol
    'HBAR',   // +63%/ano | 6.3 anos | Hedera
    'ETH',    // +62%/ano | 8.4 anos | Ethereum
    'MATIC',  // +61%/ano | 5.4 anos | Polygon
    'LINK',   // +52%/ano | 7.0 anos | Chainlink
    'ADA',    // +51%/ano | 7.7 anos | Cardano
];

// API: Top criptos curadas (projetos consolidados)
app.get('/api/cryptos', async (req, res) => {
    try {
        if (cache.cryptos.data && Date.now() - cache.cryptos.timestamp < CACHE_DURATION) {
            return res.json(cache.cryptos.data);
        }

        // Buscar dados de preço da Binance
        const [tickerResponse, ticker24hResponse] = await Promise.all([
            axios.get('https://api.binance.com/api/v3/ticker/price'),
            axios.get('https://api.binance.com/api/v3/ticker/24hr')
        ]);

        const prices = tickerResponse.data;
        const ticker24h = ticker24hResponse.data;

        // Filtrar apenas as criptos curadas
        const usdtPairs = ticker24h
            .filter(t => t.symbol.endsWith('USDT'))
            .map(t => ({
                symbol: t.symbol.replace('USDT', ''),
                price: parseFloat(t.lastPrice),
                priceChange: parseFloat(t.priceChange),
                priceChangePercent: parseFloat(t.priceChangePercent),
                high24h: parseFloat(t.highPrice),
                low24h: parseFloat(t.lowPrice),
                volume: parseFloat(t.quoteVolume),
                trades: parseInt(t.count)
            }))
            .filter(t => CURATED_CRYPTOS.includes(t.symbol))
            .sort((a, b) => {
                // Ordenar pela ordem da lista curada (tier)
                return CURATED_CRYPTOS.indexOf(a.symbol) - CURATED_CRYPTOS.indexOf(b.symbol);
            });

        cache.cryptos = { data: usdtPairs, timestamp: Date.now() };
        res.json(usdtPairs);
    } catch (error) {
        console.error('Erro ao buscar criptos:', error.message);
        res.status(500).json({ error: 'Erro ao buscar criptomoedas' });
    }
});

// API: Backtest MA50 vs HOLD (histórico COMPLETO desde 2017)
app.get('/api/ma50-backtest/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        
        // Buscar histórico completo desde 2017
        const allKlines = [];
        let startTime = new Date('2017-01-01').getTime();
        const endTime = Date.now();
        
        while (startTime < endTime) {
            const response = await axios.get('https://api.binance.com/api/v3/klines', {
                params: {
                    symbol: `${symbol.toUpperCase()}USDT`,
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
        
        const prices = allKlines.map(k => parseFloat(k[4])); // Close prices
        
        if (prices.length < 60) {
            return res.json({ ma50Profit: 0, holdProfit: 0, trades: 0, days: prices.length });
        }
        
        // Calcular HOLD
        const holdProfit = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
        
        // Calcular MA50 strategy COM BANDA DE TOLERÂNCIA de 5%
        let cash = 10000;
        let crypto = 0;
        let trades = 0;
        const period = 50;
        const BANDA = 0.05; // 5% de tolerância para evitar whipsaw
        
        for (let i = period; i < prices.length; i++) {
            const ma = prices.slice(i - period, i).reduce((s, p) => s + p, 0) / period;
            const price = prices[i];
            const distancePercent = (price - ma) / ma;
            
            // Só compra se estiver >5% ACIMA da MA50
            if (distancePercent > BANDA && cash > 0) {
                crypto = cash / price;
                cash = 0;
                trades++;
            }
            // Só vende se estiver >5% ABAIXO da MA50
            else if (distancePercent < -BANDA && crypto > 0) {
                cash = crypto * price;
                crypto = 0;
                trades++;
            }
        }
        
        const finalValue = cash + crypto * prices[prices.length - 1];
        const ma50Profit = ((finalValue - 10000) / 10000) * 100;
        
        // Data de início
        const startDate = new Date(allKlines[0][0]).toISOString().split('T')[0];
        
        // MA50 atual e distância
        const last50 = prices.slice(-50);
        const ma50 = last50.reduce((s, p) => s + p, 0) / 50;
        const currentPrice = prices[prices.length - 1];
        const distance = ((currentPrice - ma50) / ma50) * 100;
        
        // Sinal atual com BANDA DE TOLERÂNCIA de 5%
        // Evita "whipsaw" (comprar/vender em oscilações pequenas)
        let signal = 'hold';  // AGUARDAR (entre -5% e +5%)
        if (distance > 5) signal = 'buy';      // COMPRAR: >5% acima da MA50
        else if (distance < -5) signal = 'sell'; // VENDER: >5% abaixo da MA50
        
        res.json({
            ma50Profit,
            holdProfit,
            trades,
            days: prices.length,
            winner: ma50Profit > holdProfit ? 'MA50' : 'HOLD',
            startDate,
            ma50,
            currentPrice,
            distance,
            signal
        });
        
    } catch (error) {
        console.error('Erro no backtest:', error.message);
        res.status(500).json({ error: 'Erro ao calcular backtest' });
    }
});

// API: Histórico de preços (Klines/Candlesticks)
app.get('/api/klines/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const interval = req.query.interval || '1d';
        const limit = req.query.limit || 365;

        const response = await axios.get('https://api.binance.com/api/v3/klines', {
            params: {
                symbol: `${symbol.toUpperCase()}USDT`,
                interval,
                limit
            }
        });

        const klines = response.data.map(k => ({
            timestamp: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: k[6]
        }));

        res.json(klines);
    } catch (error) {
        console.error('Erro ao buscar klines:', error.message);
        res.status(500).json({ error: 'Erro ao buscar histórico de preços' });
    }
});

// API: Simulação de investimento - Análise completa desde o início
app.post('/api/simulate', async (req, res) => {
    try {
        const { symbol, amount } = req.body;

        // Buscar TODO o histórico de preços disponível (máximo da Binance)
        const allKlines = [];
        let startTime = new Date('2017-01-01').getTime(); // Início da Binance
        const endTime = Date.now();
        
        // Buscar em lotes de 1000 (limite da API)
        while (startTime < endTime) {
            const response = await axios.get('https://api.binance.com/api/v3/klines', {
                params: {
                    symbol: `${symbol.toUpperCase()}USDT`,
                    interval: '1d',
                    startTime: startTime,
                    limit: 1000
                }
            });
            
            if (response.data.length === 0) break;
            
            allKlines.push(...response.data);
            startTime = response.data[response.data.length - 1][0] + 86400000; // +1 dia
            
            if (response.data.length < 1000) break;
        }

        const prices = allKlines.map(k => ({
            timestamp: k[0],
            date: new Date(k[0]).toISOString().split('T')[0],
            close: parseFloat(k[4])
        }));

        // Buscar histórico completo do Fear & Greed
        const fngResponse = await axios.get(`https://api.alternative.me/fng/?limit=0`);
        const fngData = fngResponse.data.data;
        const fngMap = {};
        fngData.forEach(f => {
            const date = new Date(parseInt(f.timestamp) * 1000).toISOString().split('T')[0];
            fngMap[date] = parseInt(f.value);
        });

        // Simular estratégia
        let results = simulateStrategy(prices, fngMap, amount);
        results.symbol = symbol;
        results.totalDays = prices.length;
        results.startDate = prices[0]?.date;
        results.endDate = prices[prices.length - 1]?.date;
        
        res.json(results);
    } catch (error) {
        console.error('Erro na simulação:', error.message);
        res.status(500).json({ error: 'Erro ao simular investimento' });
    }
});

function simulateStrategy(prices, fngMap, initialAmount) {
    let cash = initialAmount;
    let crypto = 0;
    let trades = [];
    let portfolioHistory = [];
    
    // Estratégia: Comprar no MEDO (<=40), Vender na GANÂNCIA EXTREMA (>=75)
    const BUY_THRESHOLD = 40;   // Compra quando F&G <= 40 (Medo)
    const SELL_THRESHOLD = 75;  // Vende quando F&G >= 75 (Ganância Extrema)

    prices.forEach((price, index) => {
        const fng = fngMap[price.date];
        
        // Se não temos dado de F&G para essa data, pular
        if (fng === undefined) {
            portfolioHistory.push({
                date: price.date,
                price: price.close,
                fng: null,
                cash: cash,
                crypto: crypto,
                totalValue: cash + (crypto * price.close)
            });
            return;
        }
        
        // Lógica de COMPRA no MEDO (F&G <= 40)
        if (fng <= BUY_THRESHOLD && cash > 0) {
            const buyAmount = cash; // Compra com TODO o cash disponível
            const cryptoBought = buyAmount / price.close;
            crypto += cryptoBought;
            cash = 0;
            trades.push({
                date: price.date,
                type: 'BUY',
                price: price.close,
                amount: cryptoBought,
                cashUsed: buyAmount,
                fng: fng,
                reason: fng <= 20 ? 'Medo Extremo' : 'Medo'
            });
        }
        
        // Lógica de VENDA na GANÂNCIA EXTREMA (F&G >= 75)
        if (fng >= SELL_THRESHOLD && crypto > 0) {
            const sellAmount = crypto; // Vende TODAS as criptos
            const cashReceived = sellAmount * price.close;
            cash += cashReceived;
            crypto = 0;
            trades.push({
                date: price.date,
                type: 'SELL',
                price: price.close,
                amount: sellAmount,
                cashReceived: cashReceived,
                fng: fng,
                reason: fng >= 80 ? 'Ganância Extrema' : 'Ganância Alta'
            });
        }

        portfolioHistory.push({
            date: price.date,
            price: price.close,
            fng: fng,
            cash: cash,
            crypto: crypto,
            totalValue: cash + (crypto * price.close)
        });
    });

    const finalPrice = prices[prices.length - 1].close;
    const initialPrice = prices[0].close;
    const finalValue = cash + (crypto * finalPrice);
    const holdValue = initialAmount / initialPrice * finalPrice;

    // Estatísticas adicionais
    const buyTrades = trades.filter(t => t.type === 'BUY');
    const sellTrades = trades.filter(t => t.type === 'SELL');
    
    // Calcular lucro realizado
    let realizedProfit = 0;
    let totalInvested = 0;
    buyTrades.forEach(buy => totalInvested += buy.cashUsed || 0);
    sellTrades.forEach(sell => realizedProfit += sell.cashReceived || 0);

    return {
        initialAmount,
        finalValue,
        profit: finalValue - initialAmount,
        profitPercent: ((finalValue - initialAmount) / initialAmount) * 100,
        holdValue,
        holdProfit: holdValue - initialAmount,
        holdProfitPercent: ((holdValue - initialAmount) / initialAmount) * 100,
        trades,
        totalTrades: trades.length,
        buyCount: buyTrades.length,
        sellCount: sellTrades.length,
        portfolioHistory,
        beatHold: finalValue > holdValue,
        currentPosition: crypto > 0 ? 'HOLDING_CRYPTO' : 'HOLDING_CASH',
        cryptoAmount: crypto,
        cashAmount: cash,
        initialPrice,
        finalPrice,
        priceChange: ((finalPrice - initialPrice) / initialPrice) * 100,
        isProfitable: finalValue > initialAmount,
        strategyDescription: `Comprar quando F&G ≤ ${BUY_THRESHOLD} (Medo), Vender quando F&G ≥ ${SELL_THRESHOLD} (Ganância Extrema)`
    };
}

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Crypto Analyzer - Análise com Medo e Ganância`);
});
