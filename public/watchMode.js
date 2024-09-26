let drawLineBtn, toggleReadOnlyBtn, toggleTrackingBtn;

function initWatchModeButtons() {
    drawLineBtn = document.getElementById('drawLineBtn');
    toggleReadOnlyBtn = document.getElementById('toggleReadOnlyBtn');
    toggleTrackingBtn = document.getElementById('toggleTrackingBtn');

    toggleReadOnlyBtn.addEventListener('click', toggleReadOnly);
    toggleTrackingBtn.addEventListener('click', toggleTracking);

    updateButtonVisibility();
}

async function toggleReadOnly() {
    try {
        const response = await fetch(`/api/kline/${currentCode}/watch-type`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ watchType: -1 }),
        });
        const result = await response.json();
        if (result.success) {
            currentWatchType = -1;
            updateButtonVisibility();
        } else {
            console.error('Failed to update watch type');
        }
    } catch (error) {
        console.error('Error toggling read-only mode:', error);
    }
}

async function toggleTracking() {
    try {
        const response = await fetch(`/api/kline/${currentCode}/watch-type`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ watchType: 0 }),
        });
        const result = await response.json();
        if (result.success) {
            currentWatchType = 0;
            updateButtonVisibility();
        } else {
            console.error('Failed to update watch type');
        }
    } catch (error) {
        console.error('Error toggling tracking mode:', error);
    }
}

function updateButtonVisibility() {
    if (currentWatchType === -1) {
        drawLineBtn.style.display = 'none';
        toggleReadOnlyBtn.style.display = 'none';
        toggleTrackingBtn.style.display = 'block';
    } else {
        drawLineBtn.style.display = 'block';
        toggleReadOnlyBtn.style.display = 'block';
        toggleTrackingBtn.style.display = 'none';
    }
}

function updateDrawLineButtonState() {
    if (currentWatchType === 0 || currentWatchType === 1) {
        drawLineBtn.disabled = false;
        drawLineBtn.textContent = '绘制直线';
    } else {
        drawLineBtn.disabled = true;
        drawLineBtn.textContent = '只读模式';
    }
    updateButtonVisibility();
}