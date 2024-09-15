const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getStocks: () => ipcRenderer.invoke('get-stocks'),
  addStock: (stock) => ipcRenderer.invoke('add-stock', stock),
  updateStock: (stock) => ipcRenderer.invoke('update-stock', stock),
  deleteStock: (id) => ipcRenderer.invoke('delete-stock', id),
  send: (channel, data) => {
    let validChannels = ['toMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  receive: (channel, func) => {
    let validChannels = ['fromMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    }
  }
})