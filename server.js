const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 6000;

let db = null;

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, 'kLine.db');
db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err)
        process.exit(1)
    } else {
        console.log('Connected to the database')
    }
});

// API routes
app.get('/api/stock-data', async (req, res) => {
    try {
        const symbol = req.query.symbol || 'SZ000001';
        const response = await axios.get('https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData', {
            params: {
                symbol: symbol,
                scale: 240,
                ma: 5,
                datalen: 300
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stock data' })
    }
});

app.get('/api/fund-data', async (req, res) => {
    try {
        const symbol = req.query.symbol || '270042';
        const url = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNHisNetList';
        const response = await axios.get(url, {
            params: {
                pageIndex: 1,
                pageSize: 300,
                plat: 'Android',
                appType: 'ttjj',
                product: 'EFund',
                Version: 1,
                deviceid: '230874bd-c234-4e40-84f1-6a1a05fad7fb',
                Fcode: symbol
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch fund data' })
    }
});

// Database API routes
app.get('/api/stocks', (req, res) => {
    db.all("SELECT id, name FROM stocks ORDER BY name ASC", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/funds', (req, res) => {
    db.all("SELECT id, name FROM fund ORDER BY name ASC", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/stocks', (req, res) => {
    const { id, name } = req.body;
    db.run("INSERT INTO stocks (id, name) VALUES (?, ?)", [id, name], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID });
    });
});

app.put('/api/stocks/:id', (req, res) => {
    const { name } = req.body;
    db.run("UPDATE stocks SET name = ? WHERE id = ?", [name, req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ changes: this.changes });
    });
});

app.delete('/api/stocks/:id', (req, res) => {
    db.run("DELETE FROM stocks WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ changes: this.changes });
    });
});

app.get('/api/kline/:id', (req, res) => {
    db.get("SELECT *, watch_type FROM kline WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

app.put('/api/kline/:id', (req, res) => {
    const { point1, date1, point2, date2 } = req.body;
    const formattedDate1 = new Date(date1).toISOString().replace('T', ' ').substring(0, 19);
    const formattedDate2 = new Date(date2).toISOString().replace('T', ' ').substring(0, 19);
    const watchType = point1 > point2 ? 1 : 0;
    db.run(
        "UPDATE kline SET point1 = ?, date1 = ?, point2 = ?, date2 = ?, rate = 0, watch_type = ? WHERE id = ?",
        [point1, formattedDate1, point2, formattedDate2, watchType, req.params.id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ changes: this.changes });
        }
    );
});

// 添加这个新路由
app.put('/api/kline/:id/watch-type', (req, res) => {
    const { id } = req.params;
    const { watchType } = req.body;
    
    db.run(
        "UPDATE kline SET watch_type = ? WHERE id = ?",
        [watchType, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message, success: false });
                return;
            }
            res.json({ changes: this.changes, success: true });
        }
    );
});

// Start server
app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`)
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close(() => {
        console.log('Database connection closed');
        process.exit(0);
    });
});