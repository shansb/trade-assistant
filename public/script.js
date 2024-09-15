console.log('Script started');

window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', message, 'at', source, lineno, colno, error);
};

let chart;
let stockCode = 'SZ000001';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded');
    const chartContainer = document.getElementById('chartContainer');
    const stockCodeElement = document.getElementById('stockCode');
    const stockSelect = document.getElementById('stockSelect');
    
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }

    // 获取股票列表并填充下拉框
    fetchStockList(stockSelect);

    // 显示股票代码
    stockCodeElement.textContent = `Stock Code: ${stockCode}`;

    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: {
            background: { color: '#ffffff' },
            textColor: '#333',
        },
        grid: {
            vertLines: { color: '#e0e0e0' },
            horzLines: { color: '#e0e0e0' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: '#dfdfdf',
        },
        timeScale: {
            borderColor: '#dfdfdf',
        },
    });

    const candleSeries = chart.addCandlestickSeries();

    // 使用新的 API 端点
    fetchRealStockData(candleSeries);

    // 添加下拉框变化事件监听器
    stockSelect.addEventListener('change', (event) => {
        stockCode = event.target.value;
        stockCodeElement.textContent = `Stock Code: ${stockCode}`;
        fetchRealStockData(candleSeries);
    });
});

// 添加窗口大小变化时重新调整图表大小的功能
window.addEventListener('resize', () => {
    const chartContainer = document.getElementById('chartContainer');
    if (chart && chartContainer) {
        chart.applyOptions({
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
        });
    }
});

async function fetchStockList(selectElement) {
    try {
        const stocks = await window.api.getStocks();
        stocks.forEach(stock => {
            const option = document.createElement('option');
            option.value = stock.id;
            option.textContent = `${stock.name} - ${stock.id}`;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching stock list:', error);
    }
}

async function fetchRealStockData(candleSeries) {
    try {
        const response = await fetch(`http://localhost:3000/api/stock-data?symbol=${stockCode}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        console.log('Raw data from API:', data);
        const formattedData = formatStockData(data);
        console.log('Formatted data:', formattedData);
        candleSeries.setData(formattedData);
        chart.timeScale().fitContent();
        console.log('Real stock data loaded successfully');
    } catch (error) {
        console.error('Error fetching real stock data:', error);
    }
}

function formatStockData(data) {
    return data.map(item => {
        const [year, month, day] = item.day.split('-').map(Number);
        return {
            time: { year, month, day },
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close)
        };
    });
}

async function addNewStock(id, name) {
    try {
        await window.api.addStock({ id, name });
        console.log('New stock added successfully');
        // 重新加载股票列表
        await fetchStockList(document.getElementById('stockSelect'));
    } catch (error) {
        console.error('Error adding new stock:', error);
    }
}

async function updateStockInfo(id, name) {
    try {
        await window.api.updateStock({ id, name });
        console.log('Stock information updated successfully');
        // 重新加载股票列表
        await fetchStockList(document.getElementById('stockSelect'));
    } catch (error) {
        console.error('Error updating stock information:', error);
    }
}

async function deleteStock(id) {
    try {
        await window.api.deleteStock(id);
        console.log('Stock deleted successfully');
        // 重新加载股票列表
        await fetchStockList(document.getElementById('stockSelect'));
    } catch (error) {
        console.error('Error deleting stock:', error);
    }
}