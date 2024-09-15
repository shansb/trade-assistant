const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());

app.get('/api/stock-data', async (req, res) => {
  try {
    const response = await axios.get('https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData', {
      params: {
        symbol: 'SZ000001',
        scale: 240,
        ma: 5,
        datalen: 30
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching stock data:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});