console.log('Script started');

window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', message, 'at', source, lineno, colno, error);
};

let chart;
let currentCode = 'SZ000001';
let isFundMode = false;
let currentSeries = null; // 添加这行来跟踪当前的图表系列
let currentLineSeries = null; // 添加这行来跟踪当前的直线系列
let currentMarkers = null; // 添加这行来跟踪当前的标记
let isDrawingMode = false;
let selectedPoints = [];
let tempMarker = null;
let confirmMarker = null;
let currentWatchType = null;


document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded');
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

    // 初始化时获取股票列表
    fetchList(false);

    // 修改下拉框变化事件监听器
    selectElement.addEventListener('change', async (event) => {
        currentCode = event.target.value;
        const response = await fetch(`/api/kline/${currentCode}`);
        const klineData = await response.json();
        currentWatchType = klineData ? klineData.watch_type : null;
        updateDrawLineButtonState();
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

    drawLineBtn.addEventListener('click', () => {
        if (currentWatchType !== 0 && currentWatchType !== 1) {
            return; // 如果是只读模式，直接返回
        }
        
        isDrawingMode = !isDrawingMode;
        drawLineBtn.textContent = isDrawingMode ? '取消绘制' : '绘制直线';
        selectedPoints = [];
        
        if (isDrawingMode) {
            // 隐藏老的直线
            if (currentLineSeries) {
                currentLineSeries.applyOptions({ visible: false });
            }
            chart.applyOptions({
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                },
            });
        } else {
            // 显示老的直线
            if (currentLineSeries) {
                currentLineSeries.applyOptions({ visible: true });
            }
            chart.applyOptions({
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Magnet,
                },
            });
            // 清除所有标记
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
            // 更新临时标记
            tempMarker = {
                time: time,
                position: 'inBar',
                color: 'rgba(255, 0, 0, 0.5)',
                shape: 'circle',
                size: 1
            };

            // 使用 setMarkers 方法来更新标记
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

            // 更新确认标记
            confirmMarker = {
                time: time,
                position: 'inBar',
                color: 'rgba(255, 0, 0, 1)',
                shape: 'circle',
                size: 2
            };

            // 使用 setMarkers 方法来更新标记
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
                // 清除所有标记
                currentSeries.setMarkers([]);
                tempMarker = null;
                confirmMarker = null;
            }
        }
    });

    initWatchModeButtons();
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

    // 保存当前的可见范围
    const currentVisibleRange = chart.timeScale().getVisibleRange();

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
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });

    // 重置 currentLineSeries
    currentLineSeries = null;

    await fetchData(currentSeries);
    console.log('Fetched data, now drawing kline');
    
    // 获取 K 线数据和 watch_type
    const response = await fetch(`/api/kline/${currentCode}`);
    const klineData = await response.json();
    currentWatchType = klineData ? klineData.watch_type : null;
    
    // 更新绘制直线按钮的状态
    updateDrawLineButtonState();
    
    // 立即绘制 K 线
    await drawKlineLine(klineData);
    
    // 恢复之前的可见范围
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
        // console.log('Raw data:', data);
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

async function drawKlineLine(klineData) {
    // console.log('drawKlineLine called with klineData:', klineData);
    try {
        if (!klineData) {
            console.log('No klineData provided, fetching from API...');
            const response = await fetch(`/api/kline/${currentCode}`);
            klineData = await response.json();
        }
        // console.log('klineData after potential fetch:', klineData);
        if (klineData && klineData.point1 && klineData.date1 && klineData.point2 && klineData.date2) {
            const { point1, date1, point2, date2 } = klineData;
            
            // 移除旧的线系列和标记（如果存在）
            if (currentLineSeries) {
                chart.removeSeries(currentLineSeries);
            }
            if (currentMarkers) {
                currentSeries.setMarkers([]);
            }

            // 将日期转换为时间戳
            const time1 = convertToTimestamp(date1);
            const time2 = convertToTimestamp(date2);
            console.log('Converted timestamps:', time1, time2);

            if (time1 === null || time2 === null) {
                throw new Error('Invalid date input');
            }

            // 获取所有数据点
            const allData = currentSeries.data();

            // 查找对应的索引
            const index1 = allData.findIndex(d => convertDateObjectToTimestamp(d.time) === time1);
            const index2 = allData.findIndex(d => convertDateObjectToTimestamp(d.time) === time2);

            // 检查是否找到了对应的日期
            if (index1 === -1 || index2 === -1) {
                alert(`无法在当前数据中找到 Kline 的日期。\n日期1: ${date1}\n日期2: ${date2}`);
                return; // 提前退出函数，不绘制直线
            }

            // 创建新的线系列
            currentLineSeries = chart.addLineSeries({
                color: 'rgba(33, 150, 243, 0.8)',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Solid,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBorderColor: 'rgb(33, 150, 243)',
                crosshairMarkerBackgroundColor: 'rgb(255, 255, 255)',
            });

            // 计算直线斜率和截距
            const slope = (parseFloat(point2) - parseFloat(point1)) / (index2 - index1);
            const intercept = parseFloat(point1) - slope * index1;

            console.log('Slope and intercept:', slope, intercept);

            // 使用整个数据范围来创建直线数据点
            const lineData = allData.map((d, index) => ({
                time: d.time,
                value: slope * index + intercept
            }));

            // console.log('Line data:', lineData);

            // 设置直线数据
            currentLineSeries.setData(lineData);

            // 添加标记
            currentMarkers = [
                { time: date1, position: 'inBar', color: '#f68410', shape: 'circle', text: 'P1' },
                { time: date2, position: 'inBar', color: '#f68410', shape: 'circle', text: 'P2' }
            ];
            currentSeries.setMarkers(currentMarkers);

            // 设置标记的 y 坐标为直线上的点
            const marker1 = currentMarkers[0];
            const marker2 = currentMarkers[1];
            marker1.y = parseFloat(point1);
            marker2.y = parseFloat(point2);

            currentSeries.setMarkers(currentMarkers);

        } else {
            console.log('No valid kline data found for:', currentCode);
            // 如果没有有效的 kline 数据，移除现有的直线和标记
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
        alert(`绘制 Kline 时发生错误: ${error.message}`);
        // 发生错误时，也移除现有的直线和标记
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