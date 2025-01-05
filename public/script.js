console.log('Script started');
console.log('Toast function available:', typeof showToast === 'function');

window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', message, 'at', source, lineno, colno, error);
};

let chart;
let currentCode = 'SZ000001';
let isFundMode = false;
let currentSeries = null;
let currentLineSeries = null;
let currentMarkers = null;
let isDrawingMode = false;
let selectedPoints = [];
let tempMarker = null;
let confirmMarker = null;
let currentWatchType = null;

document.addEventListener('DOMContentLoaded', () => {
    const chartContainer = document.getElementById('chartContainer');
    const selectElement = document.getElementById('stockSelect');
    const toggleButton = document.getElementById('toggleButton');
    const drawLineBtn = document.getElementById('drawLineBtn');
    
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }

    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: {
            background: { type: 'solid', color: '#ffffff' },
            textColor: '#333333',
        },
        grid: {
            vertLines: { color: '#e0e0e0' },
            horzLines: { color: '#e0e0e0' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                width: 1,
                color: 'rgba(224, 227, 235, 0.8)',
                style: 0,
            },
            horzLine: {
                width: 1,
                color: 'rgba(224, 227, 235, 0.8)',
                style: 0,
            },
        },
        rightPriceScale: {
            borderColor: '#e0e0e0',
        },
        timeScale: {
            borderColor: '#e0e0e0',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    fetchList(false);

    selectElement.addEventListener('change', async (event) => {
        currentCode = event.target.value;
        try {
            const response = await fetch(`/api/kline/${currentCode}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            let klineData;
            try {
                klineData = JSON.parse(text);
            } catch (e) {
                showToast(`无法解析 K 线数据: ${e.message}`, 'error');
                return;
            }
            currentWatchType = klineData ? klineData.watch_type : null;
            updateWatchModeButtons();
            updateChart();
        } catch (error) {
            showToast(`获取 K 线数据失败: ${error.message}`, 'error');
        }
    });

    toggleButton.addEventListener('click', () => {
        isFundMode = !isFundMode;
        toggleButton.textContent = isFundMode ? '切换到股票' : '切换到基金';
        fetchList(isFundMode);
    });

    const debouncedDrawKlineLine = debounce(() => {
        drawKlineLine();
    }, 300);

    // chart.timeScale().subscribeVisibleTimeRangeChange(debouncedDrawKlineLine);

    drawLineBtn.addEventListener('click', () => {
        if (currentWatchType !== 0 && currentWatchType !== 1) {
            return;
        }
        
        isDrawingMode = !isDrawingMode;
        drawLineBtn.textContent = isDrawingMode ? '取消绘制' : '绘制直线';
        selectedPoints = [];
        
        if (isDrawingMode) {
            if (currentLineSeries) {
                currentLineSeries.applyOptions({ visible: false });
            }
            chart.applyOptions({
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                },
            });
        } else {
            if (currentLineSeries) {
                currentLineSeries.applyOptions({ visible: true });
            }
            chart.applyOptions({
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Magnet,
                },
            });
            if (currentSeries) {
                currentSeries.setMarkers([]);
            }
            tempMarker = null;
            confirmMarker = null;
        }
    });

    chartContainer.addEventListener('mousemove', (e) => {
        if (!isDrawingMode || selectedPoints.length >= 2) return;

        const logical = chart.timeScale().coordinateToLogical(e.offsetX);
        const price = currentSeries.coordinateToPrice(e.offsetY);
        const time = chart.timeScale().coordinateToTime(e.offsetX);

        if (logical !== null && time !== null) {
            tempMarker = {
                time: time,
                position: 'inBar',
                color: 'rgba(255, 0, 0, 0.5)',
                shape: 'circle',
                size: 1
            };

            currentSeries.setMarkers([tempMarker, ...(confirmMarker ? [confirmMarker] : [])]);
        }
    });

    chartContainer.addEventListener('click', (e) => {
        if (!isDrawingMode || currentWatchType !== 0 && currentWatchType !== 1) return;

        const logical = chart.timeScale().coordinateToLogical(e.offsetX);
        const price = currentSeries.coordinateToPrice(e.offsetY);
        const time = chart.timeScale().coordinateToTime(e.offsetX);

        if (logical !== null && time !== null) {
            selectedPoints.push({ time, price });

            confirmMarker = {
                time: time,
                position: 'inBar',
                color: 'rgba(255, 0, 0, 1)',
                shape: 'circle',
                size: 2
            };

            currentSeries.setMarkers([confirmMarker]);

            if (selectedPoints.length === 2) {
                updateKlineData(selectedPoints);
                isDrawingMode = false;
                drawLineBtn.textContent = '绘制直线';
                chart.applyOptions({
                    crosshair: {
                        mode: LightweightCharts.CrosshairMode.Magnet,
                    },
                });
                currentSeries.setMarkers([]);
                tempMarker = null;
                confirmMarker = null;
            }
        }
    });

    initWatchModeButtons();
});

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

    const currentVisibleRange = chart.timeScale().getVisibleRange();

    if (currentSeries) {
        chart.removeSeries(currentSeries);
    }

    if (currentLineSeries) {
        chart.removeSeries(currentLineSeries);
    }

    currentSeries = chart.addCandlestickSeries({
        upColor: '#FF3333',      // 鲜红色
        downColor: '#33CC33',    // 鲜绿色
        borderUpColor: '#FF3333',// 鲜红色
        borderDownColor: '#33CC33',// 鲜绿色
        wickUpColor: '#FF3333',  // 鲜红色
        wickDownColor: '#33CC33',// 鲜绿色
    });

    currentLineSeries = null;

    await fetchData(currentSeries);
    
    const response = await fetch(`/api/kline/${currentCode}`);
    const klineData = await response.json();
    currentWatchType = klineData ? klineData.watch_type : null;
    
    updateWatchModeButtons();
    
    await drawKlineLine(klineData);
    
    if (currentVisibleRange) {
        chart.timeScale().setVisibleRange(currentVisibleRange);
    }
}

async function fetchData(candleSeries) {
    try {
        let data;
        if (isFundMode) {
            data = await fetchFundData(currentCode);
        } else {
            data = await fetchStockData(currentCode);
        }
        if (!data || data.length === 0) {
            console.error('No data received');
            return;
        }
        candleSeries.setData(data);
        chart.timeScale().fitContent();
        await drawKlineLine();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function drawKlineLine(klineData) {
    try {
        if (!klineData) {
            const response = await fetch(`/api/kline/${currentCode}`);
            klineData = await response.json();
        }
        if (klineData && klineData.point1 && klineData.date1 && klineData.point2 && klineData.date2) {
            const { point1, date1, point2, date2 } = klineData;
            
            if (currentLineSeries) {
                chart.removeSeries(currentLineSeries);
            }
            if (currentMarkers) {
                currentSeries.setMarkers([]);
            }

            const time1 = convertToTimestamp(date1);
            const time2 = convertToTimestamp(date2);

            if (time1 === null || time2 === null) {
                throw new Error('Invalid date input');
            }

            const allData = currentSeries.data();

            const index1 = allData.findIndex(d => convertDateObjectToTimestamp(d.time) === time1);
            const index2 = allData.findIndex(d => convertDateObjectToTimestamp(d.time) === time2);

            if (index1 === -1 || index2 === -1) {
                showToast(`无法在当前数据中找到 Kline 的日期。\n日期1: ${date1}\n日期2: ${date2}`, 'error');
                return;
            }

            currentLineSeries = chart.addLineSeries({
                color: 'rgba(33, 150, 243, 0.8)',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Solid,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBorderColor: 'rgb(33, 150, 243)',
                crosshairMarkerBackgroundColor: 'rgb(255, 255, 255)',
            });

            const slope = (parseFloat(point2) - parseFloat(point1)) / (index2 - index1);
            const intercept = parseFloat(point1) - slope * index1;

            const lineData = allData.map((d, index) => ({
                time: d.time,
                value: slope * index + intercept
            }));

            currentLineSeries.setData(lineData);

            currentMarkers = [
                { time: date1, position: 'inBar', color: '#f68410', shape: 'circle', text: 'P1' },
                { time: date2, position: 'inBar', color: '#f68410', shape: 'circle', text: 'P2' }
            ];
            currentSeries.setMarkers(currentMarkers);

            const marker1 = currentMarkers[0];
            const marker2 = currentMarkers[1];
            marker1.y = parseFloat(point1);
            marker2.y = parseFloat(point2);

            currentSeries.setMarkers(currentMarkers);

        } else {
            if (currentLineSeries) {
                chart.removeSeries(currentLineSeries);
                currentLineSeries = null;
            }
            if (currentMarkers) {
                currentSeries.setMarkers([]);
                currentMarkers = null;
            }
        }
    } catch (error) {
        console.error('Error fetching or drawing kline data:', error);
        showToast(`绘制 Kline 时发生错误: ${error.message}`, 'error');
        if (currentLineSeries) {
            chart.removeSeries(currentLineSeries);
            currentLineSeries = null;
        }
        if (currentMarkers) {
            currentSeries.setMarkers([]);
            currentMarkers = null;
        }
    }
}

async function fetchStockData(symbol) {
    const response = await fetch(`/api/stock-data?symbol=${symbol}`);
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
    const response = await fetch(`/api/fund-data?symbol=${symbol}`);
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