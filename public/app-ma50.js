// Estado global
let cryptoData = [];
let cryptoMA50Data = [];
let priceChart = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadCryptos();
});

// Carregar criptos e calcular MA50
async function loadCryptos() {
    document.getElementById('cryptoLoading').style.display = 'flex';
    document.getElementById('cryptoTableContainer').style.display = 'none';
    
    try {
        // Buscar top 100 criptos
        const response = await fetch('/api/cryptos');
        cryptoData = await response.json();
        
        // Calcular MA50 para cada cripto (top 50 apenas para performance)
        cryptoMA50Data = [];
        const top50 = cryptoData.slice(0, 50);
        
        for (let i = 0; i < top50.length; i++) {
            const crypto = top50[i];
            document.getElementById('loadingText').textContent = 
                `Calculando MA50: ${crypto.symbol} (${i + 1}/${top50.length})`;
            
            try {
                const ma50Data = await calculateMA50(crypto.symbol);
                cryptoMA50Data.push({
                    ...crypto,
                    ...ma50Data
                });
            } catch (e) {
                console.log(`Erro ao calcular MA50 para ${crypto.symbol}`);
            }
            
            // Pequeno delay para não sobrecarregar API
            await sleep(100);
        }
        
        displayCryptos();
        updateStats();
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('pt-BR');
        
    } catch (error) {
        console.error('Erro ao carregar criptos:', error);
        document.getElementById('loadingText').textContent = 'Erro ao carregar dados';
    }
}

// Calcular MA50 para uma cripto
async function calculateMA50(symbol) {
    const response = await fetch(`/api/klines/${symbol}?interval=1d&limit=60`);
    const klines = await response.json();
    
    if (klines.length < 50) {
        return { ma50: null, signal: 'N/A', distance: 0 };
    }
    
    // Calcular MA50 (média dos últimos 50 fechamentos)
    const last50Closes = klines.slice(-50).map(k => k.close);
    const ma50 = last50Closes.reduce((sum, price) => sum + price, 0) / 50;
    
    // Preço atual
    const currentPrice = klines[klines.length - 1].close;
    
    // Distância percentual do preço em relação à MA50
    const distance = ((currentPrice - ma50) / ma50) * 100;
    
    // Determinar sinal
    let signal = 'hold';
    if (distance > 2) signal = 'buy';      // Preço > 2% acima da MA50 = COMPRAR
    else if (distance < -2) signal = 'sell'; // Preço > 2% abaixo da MA50 = VENDER
    
    // Guardar histórico para gráfico
    const history = klines.map((k, idx) => {
        // Calcular MA50 para cada ponto (se tivermos dados suficientes)
        let ma = null;
        if (idx >= 49) {
            const slice = klines.slice(idx - 49, idx + 1);
            ma = slice.reduce((sum, x) => sum + x.close, 0) / 50;
        }
        return {
            date: new Date(k.timestamp).toLocaleDateString('pt-BR'),
            price: k.close,
            ma50: ma
        };
    });
    
    return { 
        ma50, 
        signal, 
        distance,
        history,
        lastPrice: currentPrice
    };
}

// Exibir tabela de criptos
function displayCryptos() {
    document.getElementById('cryptoLoading').style.display = 'none';
    document.getElementById('cryptoTableContainer').style.display = 'block';
    
    const tbody = document.getElementById('cryptoTableBody');
    const filter = document.getElementById('filterSignal').value;
    
    let filteredData = cryptoMA50Data;
    if (filter !== 'all') {
        filteredData = cryptoMA50Data.filter(c => c.signal === filter);
    }
    
    // Ordenar: primeiro os sinais de compra/venda, depois por distância
    filteredData.sort((a, b) => {
        if (a.signal === 'buy' && b.signal !== 'buy') return -1;
        if (b.signal === 'buy' && a.signal !== 'buy') return 1;
        if (a.signal === 'sell' && b.signal !== 'sell') return -1;
        if (b.signal === 'sell' && a.signal !== 'sell') return 1;
        return Math.abs(b.distance) - Math.abs(a.distance);
    });
    
    tbody.innerHTML = filteredData.map((crypto, index) => {
        const priceClass = crypto.priceChangePercent >= 0 ? 'price-up' : 'price-down';
        const maClass = crypto.distance >= 0 ? 'above-ma' : 'below-ma';
        
        let signalBadge = '';
        if (crypto.signal === 'buy') {
            signalBadge = '<span class="badge signal-buy">🟢 COMPRAR</span>';
        } else if (crypto.signal === 'sell') {
            signalBadge = '<span class="badge signal-sell">🔴 VENDER</span>';
        } else {
            signalBadge = '<span class="badge signal-hold">🟡 AGUARDAR</span>';
        }
        
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        
        return `
            <tr>
                <td><span class="rank-badge ${rankClass}">${index + 1}</span></td>
                <td class="crypto-symbol">${crypto.symbol}</td>
                <td>$${formatNumber(crypto.price)}</td>
                <td>${crypto.ma50 ? '$' + formatNumber(crypto.ma50) : 'N/A'}</td>
                <td class="${maClass}">
                    ${crypto.distance >= 0 ? '+' : ''}${crypto.distance.toFixed(2)}%
                    ${crypto.distance >= 0 ? '↑' : '↓'}
                </td>
                <td class="${priceClass}">
                    ${crypto.priceChangePercent >= 0 ? '+' : ''}${crypto.priceChangePercent.toFixed(2)}%
                </td>
                <td>$${formatVolume(crypto.volume)}</td>
                <td>${signalBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="showBacktest('${crypto.symbol}')">
                        <i class="fas fa-history"></i>
                    </button>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="showChart('${crypto.symbol}')">
                        <i class="fas fa-chart-line"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filtrar criptos por sinal
function filterCryptos() {
    displayCryptos();
    updateStats();
}

// Atualizar estatísticas
function updateStats() {
    const filter = document.getElementById('filterSignal').value;
    let data = cryptoMA50Data;
    
    const buyCount = data.filter(c => c.signal === 'buy').length;
    const sellCount = data.filter(c => c.signal === 'sell').length;
    const holdCount = data.filter(c => c.signal === 'hold').length;
    
    document.getElementById('buyCount').textContent = buyCount;
    document.getElementById('sellCount').textContent = sellCount;
    document.getElementById('holdCount').textContent = holdCount;
}

// Mostrar gráfico de preço vs MA50
async function showChart(symbol) {
    const crypto = cryptoMA50Data.find(c => c.symbol === symbol);
    if (!crypto || !crypto.history) {
        alert('Dados não disponíveis para este gráfico');
        return;
    }
    
    document.getElementById('chartModalTitle').textContent = `${symbol} - Preço vs MA50`;
    
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    // Destruir gráfico anterior se existir
    if (priceChart) {
        priceChart.destroy();
    }
    
    const labels = crypto.history.map(h => h.date);
    const prices = crypto.history.map(h => h.price);
    const ma50Values = crypto.history.map(h => h.ma50);
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Preço',
                    data: prices,
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'MA50',
                    data: ma50Values,
                    borderColor: '#f39c12',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#f0f6fc' }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#8b949e' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b949e', maxTicksLimit: 10 }
                }
            }
        }
    });
    
    // Info do sinal atual
    let signalHtml = '';
    if (crypto.signal === 'buy') {
        signalHtml = '<div class="alert alert-success"><strong>🟢 SINAL: COMPRAR</strong> - Preço está ' + crypto.distance.toFixed(2) + '% acima da MA50</div>';
    } else if (crypto.signal === 'sell') {
        signalHtml = '<div class="alert alert-danger"><strong>🔴 SINAL: VENDER</strong> - Preço está ' + Math.abs(crypto.distance).toFixed(2) + '% abaixo da MA50</div>';
    } else {
        signalHtml = '<div class="alert alert-warning"><strong>🟡 SINAL: AGUARDAR</strong> - Preço está muito próximo da MA50</div>';
    }
    
    document.getElementById('backtestInfo').innerHTML = signalHtml;
    
    const modal = new bootstrap.Modal(document.getElementById('chartModal'));
    modal.show();
}

// Mostrar backtest
async function showBacktest(symbol) {
    document.getElementById('chartModalTitle').textContent = `${symbol} - Backtest MA50 vs HOLD`;
    
    try {
        // Buscar mais dados históricos
        const response = await fetch(`/api/ma50-backtest/${symbol}`);
        const data = await response.json();
        
        let html = `
            <div class="row text-center mb-3">
                <div class="col-6">
                    <div class="p-3 rounded ${data.ma50Profit > data.holdProfit ? 'bg-success bg-opacity-25' : 'bg-secondary bg-opacity-25'}">
                        <h6>Estratégia MA50</h6>
                        <h3 class="${data.ma50Profit >= 0 ? 'text-success' : 'text-danger'}">
                            ${data.ma50Profit >= 0 ? '+' : ''}${data.ma50Profit.toFixed(1)}%
                        </h3>
                        <small class="text-secondary">${data.trades} trades</small>
                    </div>
                </div>
                <div class="col-6">
                    <div class="p-3 rounded ${data.holdProfit > data.ma50Profit ? 'bg-success bg-opacity-25' : 'bg-secondary bg-opacity-25'}">
                        <h6>Buy & Hold</h6>
                        <h3 class="${data.holdProfit >= 0 ? 'text-success' : 'text-danger'}">
                            ${data.holdProfit >= 0 ? '+' : ''}${data.holdProfit.toFixed(1)}%
                        </h3>
                        <small class="text-secondary">${data.days} dias</small>
                    </div>
                </div>
            </div>
            <div class="alert ${data.ma50Profit > data.holdProfit ? 'alert-success' : 'alert-warning'}">
                <strong>${data.ma50Profit > data.holdProfit ? '🏆 MA50 VENCEU!' : '🔒 HOLD VENCEU'}</strong>
                por ${Math.abs(data.ma50Profit - data.holdProfit).toFixed(1)}%
            </div>
        `;
        
        document.getElementById('backtestInfo').innerHTML = html;
        
        // Gráfico simples
        const ctx = document.getElementById('priceChart').getContext('2d');
        if (priceChart) priceChart.destroy();
        
        priceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['MA50 CrossOver', 'Buy & Hold'],
                datasets: [{
                    label: 'Retorno %',
                    data: [data.ma50Profit, data.holdProfit],
                    backgroundColor: [
                        data.ma50Profit > data.holdProfit ? 'rgba(46, 204, 113, 0.8)' : 'rgba(243, 156, 18, 0.8)',
                        data.holdProfit > data.ma50Profit ? 'rgba(46, 204, 113, 0.8)' : 'rgba(243, 156, 18, 0.8)'
                    ],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { 
                            color: '#8b949e',
                            callback: v => v + '%'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8b949e' }
                    }
                }
            }
        });
        
        const modal = new bootstrap.Modal(document.getElementById('chartModal'));
        modal.show();
        
    } catch (error) {
        alert('Erro ao carregar backtest: ' + error.message);
    }
}

// Utilitários
function formatNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (num >= 1) return num.toFixed(2);
    if (num >= 0.01) return num.toFixed(4);
    return num.toFixed(8);
}

function formatVolume(vol) {
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
    if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
    return vol.toFixed(2);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
