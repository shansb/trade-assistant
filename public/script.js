console.log('Script started');

window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', message, 'at', source, lineno, colno, error);
};

let chart;
let currentCode = 'SZ000001';
let isFundMode = false;
let currentSeries = null; // 添加这行来跟踪当前的图表系列
let currentLineSeries = null; // 添加这行来跟踪当前的直线系列

// 在文件顶部添加防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded');
    const chartContainer = document.getElementById('chartContainer');
    const selectElement = document.getElementById('stockSelect');
    const toggleButton = document.getElementById('toggleButton');
    
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }

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
            visible: true,
        },
        timeScale: {
            borderColor: '#dfdfdf',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    // 初始化时获取股票列表
    fetchList(false);

    // 修改下拉框变化事件监听器
    selectElement.addEventListener('change', (event) => {
        currentCode = event.target.value;
        updateChart();
    });

    // 修改切换按钮事件监听器
    toggleButton.addEventListener('click', () => {
        isFundMode = !isFundMode;
        toggleButton.textContent = isFundMode ? '切换到股票' : '切换到基金';
        fetchList(isFundMode);
    });

    // 使用防抖函数包装 drawKlineLine
    const debouncedDrawKlineLine = debounce(() => {
        console.log('Time range changed');
        drawKlineLine();
    }, 300); // 300ms 的延迟

    chart.timeScale().subscribeVisibleTimeRangeChange(debouncedDrawKlineLine);
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

async function updateChart() {
    if (!chart) {
        console.error('Chart is not initialized');
        return;
    }

    // 只有当 currentSeries 存在时才移除
    if (currentSeries) {
        chart.removeSeries(currentSeries);
    }

    // 只有当 currentLineSeries 存在时才移除
    if (currentLineSeries) {
        chart.removeSeries(currentLineSeries);
    }

    // 创建新的蜡烛图系列
    currentSeries = chart.addCandlestickSeries({
        upColor: '#ef5350',
        downColor: '#26a69a',
        borderUpColor: '#ef5350',
        borderDownColor: '#26a69a',
        wickUpColor: '#ef5350',
        wickDownColor: '#26a69a',
    });

    // 重置 currentLineSeries
    currentLineSeries = null;

    await fetchData(currentSeries);
    console.log('Fetched data, now drawing kline');
    
    // 等待一小段时间，确保图表已经完全加载
    setTimeout(() => {
        drawKlineLine();
    }, 100);
}

async function fetchData(candleSeries) {
    try {
        let data;
        if (isFundMode) {
            data = await fetchFundData(currentCode);
        } else {
            data = await fetchStockData(currentCode);
        }
        console.log('Raw data:', data);
        if (!data || data.length === 0) {
            console.error('No data received');
            return;
        }
        candleSeries.setData(data);
        chart.timeScale().fitContent();
        console.log('Data loaded successfully');
        await drawKlineLine(); // 在这里调用 drawKlineLine
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function drawKlineLine() {
    try {
        const klineData = await window.api.getKlineData(currentCode);
        console.log('Kline data:', klineData);
        if (klineData && klineData.point1 && klineData.date1 && klineData.point2 && klineData.date2) {
            const { point1, date1, point2, date2 } = klineData;
            
            // 移除旧的线系列（如果存在）
            if (currentLineSeries) {
                chart.removeSeries(currentLineSeries);
            }

            // 创建新的线系列
            currentLineSeries = chart.addLineSeries({
                color: 'rgba(255, 0, 0, 0.8)',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Solid,
            });

            // 将日期转换为时间戳
            const time1 = convertToTimestamp(date1);
            const time2 = convertToTimestamp(date2);
            console.log('Converted timestamps:', time1, time2);

            if (time1 === null || time2 === null) {
                throw new Error('Invalid date input');
            }

            // 计算直线斜率和截距
            const slope = (parseFloat(point2) - parseFloat(point1)) / (time2 - time1);
            const intercept = parseFloat(point1) - slope * time1;
            console.log('Slope and intercept:', slope, intercept);

            // 获取图表的整个时间范围
            const timeRange = chart.timeScale().getVisibleRange();
            console.log('Time range:', timeRange);
            if (timeRange && timeRange.from && timeRange.to) {
                // 使用图表的整个时间范围来创建直线数据点
                const fromTimestamp = convertToTimestamp(timeRange.from);
                const toTimestamp = convertToTimestamp(timeRange.to);
                
                if (fromTimestamp === null || toTimestamp === null) {
                    throw new Error('Invalid time range');
                }

                const lineData = [
                    { time: fromTimestamp, value: slope * fromTimestamp + intercept },
                    { time: toTimestamp, value: slope * toTimestamp + intercept }
                ];

                console.log('Line data:', lineData);

                // 设置直线数据
                currentLineSeries.setData(lineData);
            } else {
                console.error('Unable to get valid time range');
            }

            // 确保直线可见
            chart.timeScale().fitContent();
        } else {
            console.log('No valid kline data found for:', currentCode);
            // 如果没有有效的 kline 数据，移除现有的直线
            if (currentLineSeries) {
                chart.removeSeries(currentLineSeries);
                currentLineSeries = null;
            }
        }
    } catch (error) {
        console.error('Error fetching or drawing kline data:', error);
        // 发生错误时，也移除现有的直线
        if (currentLineSeries) {
            chart.removeSeries(currentLineSeries);
            currentLineSeries = null;
        }
    }
}

function convertToTimestamp(dateInput) {
    if (typeof dateInput === 'string') {
        // 处理日期字符串
        const [datePart, timePart] = dateInput.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart ? timePart.split(':').map(Number) : [0, 0, 0];
        return Date.UTC(year, month - 1, day, hour, minute, second) / 1000;
    } else if (dateInput instanceof Date) {
        // 处理 Date 对象
        return dateInput.getTime() / 1000;
    } else if (typeof dateInput === 'number') {
        // 如果已经是时间戳，直接返回
        return dateInput;
    } else if (dateInput && typeof dateInput === 'object' && 'year' in dateInput && 'month' in dateInput && 'day' in dateInput) {
        // 处理 {year, month, day} 对象
        return Date.UTC(dateInput.year, dateInput.month - 1, dateInput.day) / 1000;
    } else {
        console.error('Invalid date input:', dateInput);
        return null;
    }
}

// 添加这个新函数来将日期对象转换为时间戳
function convertDateObjectToTimestamp(dateObj) {
    return Date.UTC(dateObj.year, dateObj.month - 1, dateObj.day) / 1000;
}

async function fetchStockData(symbol) {
    const response = await fetch(`http://localhost:3000/api/stock-data?symbol=${symbol}`);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid stock data received');
    }
    return formatStockData(data);
}

async function fetchFundData(symbol) {
    const url = 'http://localhost:3000/api/fund-data';
    const response = await fetch(`${url}?symbol=${symbol}`);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    if (!data || !data.Datas || !Array.isArray(data.Datas)) {
        console.error('Unexpected fund data format:', data);
        throw new Error('Unexpected fund data format');
    }
    return formatFundData(data.Datas);
}

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

async function fetchList(isFund) {
    const selectElement = document.getElementById('stockSelect');
    selectElement.innerHTML = '<option value="">Select a stock/fund</option>';
    try {
        const items = isFund ? await window.api.getFunds() : await window.api.getStocks();
        if (Array.isArray(items) && items.length > 0) {
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.name} - ${item.id}`;
                selectElement.appendChild(option);
            });
            // 默认选中第一项
            selectElement.value = items[0].id;
            currentCode = items[0].id;
            if (chart) {
                updateChart(); // 只有在 chart 已初始化时才调用 updateChart
            }
        } else {
            console.warn('No items found');
        }
    } catch (error) {
        console.error(`Error fetching ${isFund ? 'fund' : 'stock'} list:`, error);
    }
}

function formatStockData(data) {
    return data.map(item => {
        const [year, month, day] = item.day.split('-').map(Number);
        return {
            time: { year, month, day },
            open: parseFloat(item.open) || 0,
            high: parseFloat(item.high) || 0,
            low: parseFloat(item.low) || 0,
            close: parseFloat(item.close) || 0
        };
    }).filter(item => item.open && item.high && item.low && item.close);
}

function formatFundData(data) {
    if (!Array.isArray(data) || data.length === 0) {
        console.error('Invalid fund data:', data);
        return [];
    }
    return data.map(item => {
        if (!item.FSRQ || !item.DWJZ || !item.JZZZL) {
            console.warn('Invalid fund data item:', item);
            return null;
        }
        const close = parseFloat(item.DWJZ);
        const percentage = parseFloat(item.JZZZL);
        const open = close * (1 - percentage / 100);
        const high = Math.max(close, open);
        const low = Math.min(close, open);
        const [year, month, day] = item.FSRQ.split('-').map(Number);
        return {
            time: { year, month, day },
            open: open,
            high: high,
            low: low,
            close: close,
            volume: 0,
            turnover: 0
        };
    }).filter(item => item !== null).reverse();
}

function convertToMilliseconds(dateString) {
    return new Date(dateString).getTime();
}