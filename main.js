const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const sqlite3 = require('sqlite3').verbose()

const server = express()
const PORT = 3000

// 连接到数据库
const db = new sqlite3.Database('./kLine.db', (err) => {
  if (err) {
    console.error('Error connecting to the database:', err)
  }
})

// Middleware
server.use(cors())
server.use(express.static('public'))

// API routes
server.get('/api/stock-data', async (req, res) => {
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

server.get('/api/fund-data', async (req, res) => {
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

// Start server
server.listen(PORT)

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadURL(`http://localhost:${PORT}`)
  win.webContents.openDevTools()
}

if (app) {
  app.whenReady().then(createWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
} else {
  console.error('Electron app object is not available')
}

app.on('quit', () => {
  db.close()
})

// IPC handlers
ipcMain.handle('get-stocks', () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, name FROM stocks ORDER BY name ASC", [], (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
})

ipcMain.handle('get-funds', () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, name FROM fund ORDER BY name ASC", [], (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
})

ipcMain.handle('add-stock', (event, { id, name }) => {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO stocks (id, name) VALUES (?, ?)", [id, name], function(err) {
      if (err) reject(err)
      else resolve(this.lastID)
    })
  })
})

ipcMain.handle('update-stock', (event, { id, name }) => {
  return new Promise((resolve, reject) => {
    db.run("UPDATE stocks SET name = ? WHERE id = ?", [name, id], function(err) {
      if (err) reject(err)
      else resolve(this.changes)
    })
  })
})

ipcMain.handle('delete-stock', (event, id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM stocks WHERE id = ?", [id], function(err) {
      if (err) reject(err)
      else resolve(this.changes)
    })
  })
})

ipcMain.handle('get-kline-data', async (event, id) => {
  return new Promise((resolve, reject) => {
    console.log('Fetching kline data for id:', id);
    db.get("SELECT *, watch_type FROM kline WHERE id = ?", [id], (err, row) => {
      if (err) {
        console.error('Error fetching kline data:', err);
        reject(err);
      } else {
        console.log('Kline data fetched:', row);
        resolve(row);
      }
    });
  });
});

// 删除 'get-watch-type' 处理程序，因为我们不再需要它