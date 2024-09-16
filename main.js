const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const sqlite3 = require('sqlite3').verbose()

const server = express()
const PORT = 3000

let db = null;

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
const expressServer = server.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`)
})

function createWindow () {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    icon: path.join(__dirname, 'assets/icon.png'), // 设置应用图标
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false // 先不显示窗口
  })

  // 最大化窗口
  win.maximize();

  // 选择数据库文件
  dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const dbPath = result.filePaths[0];
      // 连接到数据库
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error connecting to the database:', err)
          app.quit()
        } else {
          console.log('Connected to the database')
          // 加载页面
          win.loadURL(`http://localhost:${PORT}`)
          win.show() // 显示窗口
          win.webContents.openDevTools()
        }
      })
    } else {
      app.quit() // 如果用户取消选择，退出应用
    }
  }).catch(err => {
    console.error('Error selecting database file:', err)
    app.quit()
  })
}

if (app) {
  app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      expressServer.close(() => {
        console.log('Express server closed')
        if (db) {
          db.close(() => {
            console.log('Database connection closed')
            app.quit()
          })
        } else {
          app.quit()
        }
      })
    }
  })
} else {
  console.error('Electron app object is not available')
}

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
    db.get("SELECT *, watch_type FROM kline WHERE id = ?", [id], (err, row) => {
      if (err) {
        console.error('Error fetching kline data:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
});

ipcMain.handle('update-kline-data', async (event, klineData) => {
  return new Promise((resolve, reject) => {
    const { id, point1, date1, point2, date2 } = klineData;
    db.run(
      "UPDATE kline SET point1 = ?, date1 = ?, point2 = ?, date2 = ? WHERE id = ?",
      [point1, date1, point2, date2, id],
      function(err) {
        if (err) {
          console.error('Error updating kline data:', err);
          reject(err);
        } else {
          console.log('Kline data updated successfully');
          resolve(this.changes);
        }
      }
    );
  });
});
