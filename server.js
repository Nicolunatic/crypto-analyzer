const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurar axios com headers para evitar bloqueio
const api = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
    },
    timeout: 30000
});

// Cache para evitar muitas requisições
let cache = {
    fearGreed: { data: null, timestamp: 0 },
    cryptos: { data: null, timestamp: 0 },
    klines: {}
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const KLINE_CACHE_DURATION = 60 * 60 * 1000; // 1 hora

// TOP 17 PORTFOLIO - Selecionadas por RENDIMENTO ANUALIZADO MA50
const CURATED_CRYPTOS = [
    { symbol: 'SOL', id: 'solana', name: 'Solana' },
    { symbol: 'SUI', id: 'sui', name: 'Sui' },
    { symbol: 'DOGE', id: 'dogecoin', name: 'Dogecoin' },
    { symbol: 'BNB', id: 'binancecoin', name: 'BNB' },
    { symbol: 'FET', id: 'fetch-ai', name: 'Fetch.ai' },
    { symbol: 'RUNE', id: 'thorchain', name: 'THORChain' },
    { symbol: 'PENDLE', id: 'pendle', name: 'Pendle' },
    { symbol: 'AVAX', id: 'avalanche-2', name: 'Avalanche' },
    { symbol: 'SEI', id: 'sei-network', name: 'Sei' },
    { symbol: 'VET', id: 'vechain', name: 'VeChain' },
    { symbol: 'BTC', id: 'bitcoin', name: 'Bitcoin' },
    { symbol: 'NEAR', id: 'near', name: 'NEAR Protocol' },
    { symbol: 'HBAR', id: 'hedera-hashgraph', name: 'Hedera' },
    { symbol: 'ETH', id: 'ethereum', name: 'Ethereum' },
    { symbol: 'MATIC', id: 'matic-network', name: 'Polygon' },
    { symbol: 'LINK', id: 'chainlink', name: 'Chainlink' },
    { symbol: 'ADA', id: 'cardano', name: 'Cardano' },
];

// API: Fear & Greed
app.get('/api/fear-greed', async (req, res) => {
    try {
        if (cache.fearGreed.data && Date.now() - cache.fearGreed.timestamp < CACHE_DURATION) {
            return res.json(cache.fearGreed.data);
        }
        const response = await api.get('https://api.alternative.me/fng/?limit=1');
        cache.fearGreed = { data: response.data, timestamp: Date.now() };
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Lista de criptos (CoinGecko - SEM BLOQUEIO GEOGRÁFICO)
app.get('/api/cryptos', async (req, res) => {
    try {
        if (cache.cryptos.data && Date.now() - cache.cryptos.timestamp < CACHE_DURATION) {
            return res.json(cache.cryptos.data);
        }

        const ids = CURATED_CRYPTOS.map(c => c.id).join(',');
        const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + ids + '&order=market_cap_desc&sparkline=false&price_change_percentage=24h';
        const response = await api.get(url);
        
        const cryptos = response.data.map(coin => {
            const curated = CURATED_CRYPTOS.find(c => c.id === coin.id);
            return {
                symbol: curated ? curated.symbol : coin.symbol.toUpperCase(),
                price: coin.current_price,
                priceChangePercent: coin.price_change_percentage_24h || 0,
                high24h: coin.high_24h,
                low24h: coin.low_24h,
                volume: coin.total_volume,
                marketCap: coin.market_cap,
                coinGeckoId: coin.id
            };
        }).sort((a, b) => {
            const aIndex = CURATED_CRYPTOS.findIndex(c => c.symbol === a.symbol);
            const bIndex = CURATED_CRYPTOS.findIndex(c => c.symbol === b.symbol);
            return aIndex - bIndex;
        });

        cache.cryptos = { data: cryptos, timestamp: Date.now() };
        res.json(cryptos);
    } catch (error) {
        console.error('Erro CoinGecko:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Histórico de preços e backtest MA50 (CoinGecko - 365 dias)
app.get('/api/ma50-backtest/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const cacheKey = symbol.toUpperCase();
        
        if (cache.klines[cacheKey] && Date.now() - cache.klines[cacheKey].timestamp < KLINE_CACHE_DURATION) {
            return res.json(cache.klines[cacheKey].data);
        }

        const curated = CURATED_CRYPTOS.find(c => c.symbol === symbol.toUpperCase());
        if (!curated) {
            return res.json({ error: 'Crypto not found', days: 0 });
        }

        // CoinGecko: máximo 365 dias grátis
        const url = 'https://api.coingecko.com/api/v3/coins/' + curated.id + '/market_chart?vs_currency=usd&days=365&interval=daily';
        const response = await api.get(url);
        
        const prices = response.data.prices.map(p => p[1]);
        
        if (prices.length < 60) {
            return res.json({ error: 'Not enough data', days: prices.length });
        }

        // Calcular HOLD
        const holdProfit = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

        // Calcular MA50 strategy COM BANDA DE 5%
        let cash = 10000;
        let crypto = 0;
        let trades = 0;
        const period = 50;
        const BANDA = 0.05;

        for (let i = period; i < prices.length; i++) {
            const ma = prices.slice(i - period, i).reduce((s, p) => s + p, 0) / period;
            const price = prices[i];
            const distancePercent = (price - ma) / ma;

            if (distancePercent > BANDA && cash > 0) {
                crypto = cash / price;
                cash = 0;
                trades++;
            } else if (distancePercent < -BANDA && crypto > 0) {
                cash = crypto * price;
                crypto = 0;
                trades++;
            }
        }

        const finalValue = cash + crypto * prices[prices.length - 1];
        const ma50Profit = ((finalValue - 10000) / 10000) * 100;

        // MA50 atual
        const last50 = prices.slice(-50);
        const ma50 = last50.reduce((s, p) => s + p, 0) / 50;
        const currentPrice = prices[prices.length - 1];
        const distance = ((currentPrice - ma50) / ma50) * 100;

        let signal = 'hold';
        if (distance > 5) signal = 'buy';
        else if (distance < -5) signal = 'sell';

        const result = {
            ma50Profit: Math.round(ma50Profit * 10) / 10,
            holdProfit: Math.round(holdProfit * 10) / 10,
            trades,
            days: prices.length,
            winner: ma50Profit > holdProfit ? 'MA50' : 'HOLD',
            ma50: Math.round(ma50 * 100) / 100,
            currentPrice: Math.round(currentPrice * 100) / 100,
            distance: Math.round(distance * 10) / 10,
            signal
        };

        cache.klines[cacheKey] = { data: result, timestamp: Date.now() };
        res.json(result);
    } catch (error) {
        console.error('Erro backtest:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});
