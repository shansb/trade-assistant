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


function formatDate(time) {
    console.log('Formatting date:', time);  // 添加这行来记录输入
    if (time instanceof Date) {
        return `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}`;
    } else if (typeof time === 'object' && 'year' in time && 'month' in time && 'day' in time) {
        return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
    } else {
        console.error('Invalid time format:', time);
        return 'Invalid Date';
    }
}

function updateDrawLineButtonState() {
    const drawLineBtn = document.getElementById('drawLineBtn');
    if (currentWatchType === 0 || currentWatchType === 1) {
        drawLineBtn.disabled = false;
        drawLineBtn.textContent = '绘制直线';
    } else {
        drawLineBtn.disabled = true;
        drawLineBtn.textContent = '只读模式';
    }
}



function convertToMilliseconds(dateString) {
    return new Date(dateString).getTime();
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


// 添加这个新函数来将日期对象转换为时间戳
function convertDateObjectToTimestamp(dateObj) {
    return Date.UTC(dateObj.year, dateObj.month - 1, dateObj.day) / 1000;
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