// Estado global
let cryptoData = [];
let fngData = null;
let fngHistory = [];
let simChart = null;
let projChart = null;
let allSimResults = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initDates();
    loadFearGreedIndex();
    loadFearGreedHistory();
    loadCryptos();
});

function initDates() {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    const formatDate = (d) => d.toISOString().split('T')[0];
    
    document.getElementById('projBuyDate').value = formatDate(oneYearAgo);
    document.getElementById('projSellDate').value = formatDate(today);
}

// Fear & Greed Index
async function loadFearGreedIndex() {
    try {
        const response = await fetch('/api/fear-greed');
        const data = await response.json();
        fngData = data.data[0];
        
        displayFearGreedIndex(fngData);
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('pt-BR');
    } catch (error) {
        console.error('Erro ao carregar F&G:', error);
    }
}

function displayFearGreedIndex(data) {
    const value = parseInt(data.value);
    const classification = data.value_classification;
    
    document.getElementById('fngLoading').style.display = 'none';
    document.getElementById('fngContent').style.display = 'block';
    
    const valueEl = document.getElementById('fngValue');
    const labelEl = document.getElementById('fngLabel');
    const progressEl = document.getElementById('fngProgress');
    
    valueEl.textContent = value;
    labelEl.textContent = getPortugueseClassification(classification);
    
    // Set color class
    valueEl.className = 'fng-value ' + getFngColorClass(value);
    labelEl.className = 'fng-label ' + getFngColorClass(value);
    
    // Progress bar
    progressEl.style.width = value + '%';
    progressEl.className = 'progress-bar ' + getFngBgClass(value);
}

function getPortugueseClassification(classification) {
    const map = {
        'Extreme Fear': 'Medo Extremo',
        'Fear': 'Medo',
        'Neutral': 'Neutro',
        'Greed': 'Ganância',
        'Extreme Greed': 'Ganância Extrema'
    };
    return map[classification] || classification;
}

function getFngColorClass(value) {
    if (value <= 20) return 'fng-extreme-fear';
    if (value <= 40) return 'fng-fear';
    if (value <= 60) return 'fng-neutral';
    if (value <= 80) return 'fng-greed';
    return 'fng-extreme-greed';
}

function getFngBgClass(value) {
    if (value <= 20) return 'bg-danger';
    if (value <= 40) return 'bg-warning';
    if (value <= 60) return 'bg-info';
    if (value <= 80) return 'bg-success';
    return 'bg-success';
}

async function loadFearGreedHistory() {
    try {
        const response = await fetch('/api/fear-greed/history?limit=30');
        const data = await response.json();
        fngHistory = data.data.reverse();
        
        displayFngChart();
    } catch (error) {
        console.error('Erro ao carregar histórico F&G:', error);
    }
}

function displayFngChart() {
    const ctx = document.getElementById('fngChart').getContext('2d');
    
    const labels = fngHistory.map(d => {
        const date = new Date(parseInt(d.timestamp) * 1000);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });
    
    const values = fngHistory.map(d => parseInt(d.value));
    
    const colors = values.map(v => {
        if (v <= 20) return 'rgba(231, 76, 60, 0.8)';
        if (v <= 40) return 'rgba(230, 126, 34, 0.8)';
        if (v <= 60) return 'rgba(243, 156, 18, 0.8)';
        if (v <= 80) return 'rgba(39, 174, 96, 0.8)';
        return 'rgba(46, 204, 113, 0.8)';
    });
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Índice de Medo & Ganância',
                data: values,
                backgroundColor: colors,
                borderRadius: 4
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
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#8b949e' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b949e', maxRotation: 45 }
                }
            }
        }
    });
}

// Cryptos
async function loadCryptos() {
    document.getElementById('cryptoLoading').style.display = 'flex';
    document.getElementById('cryptoTableContainer').style.display = 'none';
    
    try {
        const response = await fetch('/api/cryptos');
        cryptoData = await response.json();
        
        displayCryptos();
    } catch (error) {
        console.error('Erro ao carregar criptos:', error);
    }
}

function displayCryptos() {
    document.getElementById('cryptoLoading').style.display = 'none';
    document.getElementById('cryptoTableContainer').style.display = 'block';
    
    const tbody = document.getElementById('cryptoTableBody');
    const fngValue = fngData ? parseInt(fngData.value) : 50;
    
    tbody.innerHTML = cryptoData.map((crypto, index) => {
        const recommendation = getRecommendation(crypto, fngValue);
        const priceClass = crypto.priceChangePercent >= 0 ? 'price-up' : 'price-down';
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        
        return `
            <tr>
                <td>
                    <span class="rank-badge ${rankClass}">${index + 1}</span>
                </td>
                <td class="crypto-symbol">${crypto.symbol}</td>
                <td>$${formatNumber(crypto.price)}</td>
                <td class="${priceClass}">
                    ${crypto.priceChangePercent >= 0 ? '+' : ''}${crypto.priceChangePercent.toFixed(2)}%
                </td>
                <td>$${formatVolume(crypto.volume)}</td>
                <td>$${formatNumber(crypto.high24h)}</td>
                <td>$${formatNumber(crypto.low24h)}</td>
                <td>
                    <span class="badge ${recommendation.class}">${recommendation.text}</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="selectCryptoForSimulation('${crypto.symbol}')">
                        <i class="fas fa-flask"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getRecommendation(crypto, fngValue) {
    // Lógica baseada no F&G e na variação de preço
    let score = 50;
    
    // F&G baixo = bom para comprar
    if (fngValue <= 20) score += 30;
    else if (fngValue <= 40) score += 15;
    else if (fngValue >= 80) score -= 30;
    else if (fngValue >= 60) score -= 15;
    
    // Preço caindo = oportunidade (se F&G está em medo)
    if (fngValue <= 40 && crypto.priceChangePercent < -5) score += 10;
    if (fngValue >= 60 && crypto.priceChangePercent > 5) score -= 10;
    
    if (score >= 70) return { text: 'Compra Forte', class: 'badge-strong-buy' };
    if (score >= 55) return { text: 'Comprar', class: 'badge-buy' };
    if (score >= 45) return { text: 'Manter', class: 'badge-hold' };
    if (score >= 30) return { text: 'Vender', class: 'badge-sell' };
    return { text: 'Venda Forte', class: 'badge-strong-sell' };
}

function sortCryptos() {
    const sortBy = document.getElementById('sortBy').value;
    const fngValue = fngData ? parseInt(fngData.value) : 50;
    
    switch(sortBy) {
        case 'change':
            cryptoData.sort((a, b) => b.priceChangePercent - a.priceChangePercent);
            break;
        case 'recommendation':
            cryptoData.sort((a, b) => {
                const scoreA = getRecommendationScore(a, fngValue);
                const scoreB = getRecommendationScore(b, fngValue);
                return scoreB - scoreA;
            });
            break;
        default:
            cryptoData.sort((a, b) => b.volume - a.volume);
    }
    
    displayCryptos();
}

function getRecommendationScore(crypto, fngValue) {
    let score = 50;
    if (fngValue <= 20) score += 30;
    else if (fngValue <= 40) score += 15;
    else if (fngValue >= 80) score -= 30;
    else if (fngValue >= 60) score -= 15;
    if (fngValue <= 40 && crypto.priceChangePercent < -5) score += 10;
    if (fngValue >= 60 && crypto.priceChangePercent > 5) score -= 10;
    return score;
}

function selectCryptoForSimulation(symbol) {
    document.getElementById('simCrypto').value = symbol;
    document.getElementById('projCrypto').value = symbol;
    
    // Switch to simulator tab and run
    const tab = new bootstrap.Tab(document.getElementById('simulator-tab'));
    tab.show();
    runSingleSimulation();
}

// ============ SIMULAÇÃO ============

async function runSingleSimulation() {
    const symbol = document.getElementById('simCrypto').value.toUpperCase();
    const amount = parseFloat(document.getElementById('simAmount').value);
    
    if (!symbol) {
        alert('Por favor, digite o símbolo da criptomoeda');
        return;
    }
    
    showSimLoading(`Analisando ${symbol} desde o início...`);
    
    try {
        const response = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, amount })
        });
        
        if (!response.ok) {
            throw new Error('Cripto não encontrada ou erro na API');
        }
        
        const results = await response.json();
        displaySingleSimResult(results);
    } catch (error) {
        console.error('Erro na simulação:', error);
        alert('Erro ao analisar: ' + error.message);
        hideSimLoading();
    }
}

async function runAllSimulations() {
    const amount = parseFloat(document.getElementById('simAmount').value);
    
    if (cryptoData.length === 0) {
        alert('Aguarde carregar a lista de criptos');
        return;
    }
    
    showSimLoading('Analisando todas as criptomoedas... 0/' + cryptoData.length);
    
    allSimResults = [];
    const cryptosToAnalyze = cryptoData.slice(0, 50); // Top 50 para não demorar muito
    
    for (let i = 0; i < cryptosToAnalyze.length; i++) {
        const crypto = cryptosToAnalyze[i];
        document.getElementById('simLoadingText').textContent = 
            `Analisando ${crypto.symbol}... ${i + 1}/${cryptosToAnalyze.length}`;
        
        try {
            const response = await fetch('/api/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: crypto.symbol, amount })
            });
            
            if (response.ok) {
                const results = await response.json();
                allSimResults.push(results);
            }
        } catch (error) {
            console.error(`Erro ao analisar ${crypto.symbol}:`, error);
        }
        
        // Pequeno delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    displayAllSimResults();
}

function showSimLoading(text) {
    document.getElementById('simLoading').style.display = 'block';
    document.getElementById('simLoadingText').textContent = text;
    document.getElementById('singleSimResult').style.display = 'none';
    document.getElementById('allSimResults').style.display = 'none';
}

function hideSimLoading() {
    document.getElementById('simLoading').style.display = 'none';
}

function displaySingleSimResult(results) {
    hideSimLoading();
    document.getElementById('singleSimResult').style.display = 'block';
    document.getElementById('allSimResults').style.display = 'none';
    
    // Período
    document.getElementById('singlePeriod').textContent = 
        `${results.startDate} a ${results.endDate}`;
    document.getElementById('singleDays').textContent = `${results.totalDays} dias`;
    
    // Estratégia
    const strategyCard = document.getElementById('singleStrategyCard');
    strategyCard.className = results.profitPercent >= 0 ? 'card bg-success bg-opacity-25' : 'card bg-danger bg-opacity-25';
    document.getElementById('singleStrategyValue').textContent = '$' + formatNumber(results.finalValue);
    const strategyPercentEl = document.getElementById('singleStrategyPercent');
    strategyPercentEl.textContent = (results.profitPercent >= 0 ? '+' : '') + results.profitPercent.toFixed(2) + '%';
    strategyPercentEl.className = results.profitPercent >= 0 ? 'badge bg-success' : 'badge bg-danger';
    
    // Hold
    const holdCard = document.getElementById('singleHoldCard');
    holdCard.className = results.holdProfitPercent >= 0 ? 'card bg-success bg-opacity-25' : 'card bg-danger bg-opacity-25';
    document.getElementById('singleHoldValue').textContent = '$' + formatNumber(results.holdValue);
    const holdPercentEl = document.getElementById('singleHoldPercent');
    holdPercentEl.textContent = (results.holdProfitPercent >= 0 ? '+' : '') + results.holdProfitPercent.toFixed(2) + '%';
    holdPercentEl.className = results.holdProfitPercent >= 0 ? 'badge bg-success' : 'badge bg-danger';
    
    // Trades
    document.getElementById('singleTrades').textContent = results.totalTrades;
    document.getElementById('singleBuys').textContent = results.buyCount;
    document.getElementById('singleSells').textContent = results.sellCount;
    
    // Veredito
    const verdictEl = document.getElementById('singleVerdict');
    if (results.isProfitable && results.beatHold) {
        verdictEl.className = 'alert alert-success';
        verdictEl.innerHTML = `<i class="fas fa-trophy me-2"></i><strong>EXCELENTE!</strong> A estratégia F&G foi LUCRATIVA (+${results.profitPercent.toFixed(2)}%) e SUPEROU o Buy & Hold em ${(results.profitPercent - results.holdProfitPercent).toFixed(2)}%!`;
    } else if (results.isProfitable) {
        verdictEl.className = 'alert alert-info';
        verdictEl.innerHTML = `<i class="fas fa-check me-2"></i><strong>BOM!</strong> A estratégia foi LUCRATIVA (+${results.profitPercent.toFixed(2)}%), mas o Buy & Hold teve resultado melhor.`;
    } else {
        verdictEl.className = 'alert alert-warning';
        verdictEl.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i><strong>ATENÇÃO!</strong> A estratégia NÃO foi lucrativa para ${results.symbol} neste período.`;
    }
    
    // Posição atual
    if (results.currentPosition === 'HOLDING_CRYPTO') {
        verdictEl.innerHTML += `<br><small class="mt-2 d-block"><i class="fas fa-coins me-1"></i>Posição atual: Segurando ${results.cryptoAmount.toFixed(6)} ${results.symbol}</small>`;
    } else {
        verdictEl.innerHTML += `<br><small class="mt-2 d-block"><i class="fas fa-dollar-sign me-1"></i>Posição atual: Segurando $${formatNumber(results.cashAmount)} em cash</small>`;
    }
    
    // Chart
    displaySimChart(results);
    
    // Trades table
    displayTradesTable(results.trades);
}

function displayAllSimResults() {
    hideSimLoading();
    document.getElementById('singleSimResult').style.display = 'none';
    document.getElementById('allSimResults').style.display = 'block';
    
    // Sort by profit
    allSimResults.sort((a, b) => b.profitPercent - a.profitPercent);
    
    // Stats
    const profitable = allSimResults.filter(r => r.isProfitable).length;
    const beatHold = allSimResults.filter(r => r.beatHold).length;
    const avgReturn = allSimResults.reduce((sum, r) => sum + r.profitPercent, 0) / allSimResults.length;
    
    document.getElementById('profitableCount').textContent = profitable;
    document.getElementById('notProfitableCount').textContent = allSimResults.length - profitable;
    document.getElementById('beatHoldCount').textContent = beatHold;
    document.getElementById('avgReturn').textContent = (avgReturn >= 0 ? '+' : '') + avgReturn.toFixed(2) + '%';
    
    // Table
    const tbody = document.getElementById('allResultsTable');
    tbody.innerHTML = allSimResults.map((r, i) => {
        const strategyClass = r.profitPercent >= 0 ? 'price-up' : 'price-down';
        const holdClass = r.holdProfitPercent >= 0 ? 'price-up' : 'price-down';
        
        let verdict, verdictClass;
        if (r.isProfitable && r.beatHold) {
            verdict = '🏆 Excelente';
            verdictClass = 'badge bg-success';
        } else if (r.isProfitable) {
            verdict = '✓ Lucrativo';
            verdictClass = 'badge bg-info';
        } else {
            verdict = '✗ Prejuízo';
            verdictClass = 'badge bg-danger';
        }
        
        return `
            <tr>
                <td>${i + 1}</td>
                <td class="crypto-symbol">${r.symbol}</td>
                <td><small>${r.startDate}<br>${r.endDate}</small></td>
                <td class="${strategyClass}">
                    $${formatNumber(r.finalValue)}<br>
                    <small>${r.profitPercent >= 0 ? '+' : ''}${r.profitPercent.toFixed(2)}%</small>
                </td>
                <td class="${holdClass}">
                    $${formatNumber(r.holdValue)}<br>
                    <small>${r.holdProfitPercent >= 0 ? '+' : ''}${r.holdProfitPercent.toFixed(2)}%</small>
                </td>
                <td>${r.totalTrades}<br><small>${r.buyCount}C / ${r.sellCount}V</small></td>
                <td>${r.beatHold ? '<span class="text-success">Bateu Hold</span>' : '<span class="text-warning">Hold melhor</span>'}</td>
                <td><span class="${verdictClass}">${verdict}</span></td>
            </tr>
        `;
    }).join('');
}

function displaySimChart(results) {
    const ctx = document.getElementById('simChart').getContext('2d');
    
    // Sample data points
    const step = Math.max(1, Math.floor(results.portfolioHistory.length / 100));
    const sampledData = results.portfolioHistory.filter((_, i) => i % step === 0);
    
    const labels = sampledData.map(d => d.date);
    const portfolioValues = sampledData.map(d => d.totalValue);
    const holdValues = sampledData.map(d => {
        const cryptoAmount = results.initialAmount / results.initialPrice;
        return cryptoAmount * d.price;
    });
    
    if (simChart) simChart.destroy();
    
    simChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Estratégia F&G',
                    data: portfolioValues,
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                },
                {
                    label: 'Buy & Hold',
                    data: holdValues,
                    borderColor: '#f39c12',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    labels: { color: '#f0f6fc' }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { 
                        color: '#8b949e',
                        callback: value => '$' + formatNumber(value)
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b949e', maxTicksLimit: 10 }
                }
            }
        }
    });
}

function displayTradesTable(trades) {
    const tbody = document.getElementById('tradesTable');
    
    if (trades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary">Nenhuma operação realizada</td></tr>';
        return;
    }
    
    tbody.innerHTML = trades.map(trade => `
        <tr>
            <td><small>${trade.date}</small></td>
            <td class="${trade.type === 'BUY' ? 'text-success' : 'text-danger'}">
                ${trade.type === 'BUY' ? '🟢 Compra' : '🔴 Venda'}
            </td>
            <td>${trade.fng}</td>
            <td>$${formatNumber(trade.price)}</td>
        </tr>
    `).join('');
}

// Projection
async function calculateProjection() {
    const symbol = document.getElementById('projCrypto').value;
    const amount = parseFloat(document.getElementById('projAmount').value);
    const buyDate = document.getElementById('projBuyDate').value;
    const sellDate = document.getElementById('projSellDate').value;
    
    if (!symbol || !amount || !buyDate || !sellDate) {
        alert('Por favor, preencha todos os campos');
        return;
    }
    
    try {
        // Get price history
        const buyTimestamp = new Date(buyDate).getTime();
        const sellTimestamp = new Date(sellDate).getTime();
        
        const response = await fetch(`/api/klines/${symbol}?interval=1d&limit=1000`);
        const klines = await response.json();
        
        // Find prices for the dates
        const buyKline = findClosestKline(klines, buyTimestamp);
        const sellKline = findClosestKline(klines, sellTimestamp);
        
        if (!buyKline || !sellKline) {
            alert('Não foi possível encontrar dados para as datas selecionadas');
            return;
        }
        
        // Get F&G data
        const fngResponse = await fetch('/api/fear-greed/history?limit=365');
        const fngData = await fngResponse.json();
        const fngMap = {};
        fngData.data.forEach(f => {
            const date = new Date(parseInt(f.timestamp) * 1000).toISOString().split('T')[0];
            fngMap[date] = { value: parseInt(f.value), classification: f.value_classification };
        });
        
        displayProjectionResults({
            buyPrice: buyKline.close,
            sellPrice: sellKline.close,
            amount,
            buyDate,
            sellDate,
            fngBuy: fngMap[buyDate],
            fngSell: fngMap[sellDate],
            klines: klines.filter(k => k.timestamp >= buyTimestamp && k.timestamp <= sellTimestamp)
        });
        
    } catch (error) {
        console.error('Erro na projeção:', error);
        alert('Erro ao calcular projeção');
    }
}

function findClosestKline(klines, timestamp) {
    let closest = null;
    let minDiff = Infinity;
    
    for (const kline of klines) {
        const diff = Math.abs(kline.timestamp - timestamp);
        if (diff < minDiff) {
            minDiff = diff;
            closest = kline;
        }
    }
    
    return closest;
}

function displayProjectionResults(data) {
    document.getElementById('projPlaceholder').style.display = 'none';
    document.getElementById('projResults').style.display = 'block';
    
    const cryptoAmount = data.amount / data.buyPrice;
    const finalValue = cryptoAmount * data.sellPrice;
    const profit = finalValue - data.amount;
    const profitPercent = ((finalValue - data.amount) / data.amount) * 100;
    const priceChange = ((data.sellPrice - data.buyPrice) / data.buyPrice) * 100;
    
    document.getElementById('projBuyPrice').textContent = '$' + formatNumber(data.buyPrice);
    document.getElementById('projSellPrice').textContent = '$' + formatNumber(data.sellPrice);
    document.getElementById('projChange').textContent = (priceChange >= 0 ? '+' : '') + priceChange.toFixed(2) + '%';
    document.getElementById('projChange').className = priceChange >= 0 ? 'price-up' : 'price-down';
    
    document.getElementById('projInvested').textContent = '$' + formatNumber(data.amount);
    document.getElementById('projFinalValue').textContent = '$' + formatNumber(finalValue);
    document.getElementById('projProfitLoss').textContent = 
        (profit >= 0 ? 'Lucro: +' : 'Prejuízo: ') + '$' + formatNumber(Math.abs(profit)) + 
        ' (' + (profitPercent >= 0 ? '+' : '') + profitPercent.toFixed(2) + '%)';
    
    const resultEl = document.getElementById('projFinalResult');
    resultEl.className = profit >= 0 ? 'result-positive p-4' : 'result-negative p-4';
    
    // F&G info
    if (data.fngBuy) {
        document.getElementById('projFngBuy').innerHTML = 
            `${data.fngBuy.value} - ${getPortugueseClassification(data.fngBuy.classification)}`;
    } else {
        document.getElementById('projFngBuy').textContent = 'Não disponível';
    }
    
    if (data.fngSell) {
        document.getElementById('projFngSell').innerHTML = 
            `${data.fngSell.value} - ${getPortugueseClassification(data.fngSell.classification)}`;
    } else {
        document.getElementById('projFngSell').textContent = 'Não disponível';
    }
    
    // Chart
    displayProjectionChart(data);
}

function displayProjectionChart(data) {
    const ctx = document.getElementById('projChart').getContext('2d');
    
    const step = Math.max(1, Math.floor(data.klines.length / 50));
    const sampledData = data.klines.filter((_, i) => i % step === 0);
    
    const labels = sampledData.map(k => new Date(k.timestamp).toLocaleDateString('pt-BR'));
    const prices = sampledData.map(k => k.close);
    
    if (projChart) projChart.destroy();
    
    projChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Preço',
                data: prices,
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { 
                        color: '#8b949e',
                        callback: value => '$' + formatNumber(value)
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b949e', maxTicksLimit: 10 }
                }
            }
        }
    });
}

// Utilities
function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return num.toFixed(2);
    if (num >= 1) return num.toFixed(4);
    if (num >= 0.0001) return num.toFixed(6);
    return num.toFixed(8);
}

function formatVolume(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
}
