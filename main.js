const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const express = require('express')
const cors = require('cors')
const axios = require('axios') // 确保已安装 axios: npm install axios
const sqlite3 = require('sqlite3').verbose()

const server = express()
const PORT = 3000

// 连接到数据库
const db = new sqlite3.Database('./kLine.db', (err) => {
  if (err) {
    console.error('Error connecting to the database:', err)
  } else {
    console.log('Connected to the database.')
  }
})

// Middleware
server.use(cors())
server.use(express.static('public'))

// API routes
server.get('/api/stock-data', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'SZ000001'; // 使用查询参数，如果没有则默认为 'SZ000001'
    const response = await axios.get('https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData', {
      params: {
        symbol: symbol,
        scale: 240,
        ma: 5,
        datalen: 30
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching stock data:', error)
    res.status(500).json({ error: 'Failed to fetch stock data' })
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

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

  // 修改这里，使用 loadURL 而不是 loadFile
  win.loadURL(`http://localhost:${PORT}`)
  win.webContents.openDevTools()

  // 添加错误监听
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })
}

// 确保这里的 app 对象是可用的
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
      app.quit()
    }
  })
} else {
  console.error('Electron app object is not available')
}

// 添加全局错误处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

// 在应用退出时关闭数据库连接
app.on('quit', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database connection:', err)
    } else {
      console.log('Database connection closed')
    }
  })
})

// 添加 IPC 监听器来获取股票列表
ipcMain.handle('get-stocks', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, name FROM stocks ORDER BY name ASC", [], (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows)
      }
    })
  })
})

// 添加 IPC 监听器来插入新的股票
ipcMain.handle('add-stock', (event, { id, name }) => {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO stocks (id, name) VALUES (?, ?)", [id, name], function(err) {
      if (err) {
        reject(err)
      } else {
        resolve(this.lastID)
      }
    })
  })
})

// 添加 IPC 监听器来更新股票信息
ipcMain.handle('update-stock', (event, { id, name }) => {
  return new Promise((resolve, reject) => {
    db.run("UPDATE stocks SET name = ? WHERE id = ?", [name, id], function(err) {
      if (err) {
        reject(err)
      } else {
        resolve(this.changes)
      }
    })
  })
})

// 添加 IPC 监听器来删除股票
ipcMain.handle('delete-stock', (event, id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM stocks WHERE id = ?", [id], function(err) {
      if (err) {
        reject(err)
      } else {
        resolve(this.changes)
      }
    })
  })
})