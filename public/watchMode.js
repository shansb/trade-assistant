let drawLineBtn, toggleReadOnlyBtn, toggleTrackingBtn;

function initWatchModeButtons() {
    drawLineBtn = document.getElementById('drawLineBtn');
    toggleReadOnlyBtn = document.getElementById('toggleReadOnlyBtn');
    toggleTrackingBtn = document.getElementById('toggleTrackingBtn');

    toggleReadOnlyBtn.addEventListener('click', toggleReadOnly);
    toggleTrackingBtn.addEventListener('click', toggleTracking);

    updateWatchModeButtons();
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
            updateWatchModeButtons();
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
            updateWatchModeButtons();
        } else {
            console.error('Failed to update watch type');
        }
    } catch (error) {
        console.error('Error toggling tracking mode:', error);
    }
}

function updateWatchModeButtons() {
    if (currentWatchType === -1) {
        drawLineBtn.style.display = 'none';
        toggleReadOnlyBtn.style.display = 'none';
        toggleTrackingBtn.style.display = 'flex';
        drawLineBtn.disabled = true;
        drawLineBtn.textContent = '只读模式';
    } else {
        drawLineBtn.style.display = 'flex';
        toggleReadOnlyBtn.style.display = 'flex';
        toggleTrackingBtn.style.display = 'none';
        drawLineBtn.disabled = false;
        drawLineBtn.textContent = '绘制直线';
    }
    drawLineBtn.style.opacity = currentWatchType === -1 ? '0.5' : '1';
}

window.updateWatchModeButtons = updateWatchModeButtons;