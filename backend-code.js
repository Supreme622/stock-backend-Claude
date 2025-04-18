// backend/index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Create data directory if it doesn't exist
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}

// Initialize stock data files for each section
const sections = ['A', 'B', 'C'];
sections.forEach(section => {
  const filePath = `data/stock_${section}.json`;
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([]));
  }
});

// Initialize transaction log
const logFilePath = 'data/transactions.json';
if (!fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, JSON.stringify([]));
}

// Helper functions for stock data
function getStockData(section) {
  try {
    const filePath = `data/stock_${section}.json`;
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading stock data for section ${section}:`, error);
    return [];
  }
}

function saveStockData(section, data) {
  try {
    const filePath = `data/stock_${section}.json`;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error saving stock data for section ${section}:`, error);
  }
}

function logTransaction(transaction) {
  try {
    const logData = fs.readFileSync(logFilePath, 'utf8');
    const transactions = JSON.parse(logData);
    transactions.push({
      ...transaction,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(logFilePath, JSON.stringify(transactions, null, 2));
  } catch (error) {
    console.error('Error logging transaction:', error);
  }
}

// Routes

// Get stock for a specific section
app.get('/stock/:section', (req, res) => {
  const { section } = req.params;
  
  if (!sections.includes(section)) {
    return res.status(400).json({ error: 'Invalid section' });
  }
  
  const stockData = getStockData(section);
  res.json(stockData);
});

// Stock in route
app.post('/stock/in', (req, res) => {
  const { section, size, quantity } = req.body;
  
  if (!section || !size || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid input data' });
  }
  
  if (!sections.includes(section)) {
    return res.status(400).json({ error: 'Invalid section' });
  }
  
  // Get current stock data
  const stockData = getStockData(section);
  
  // Find the item
  const itemIndex = stockData.findIndex(item => item.size === size);
  
  if (itemIndex !== -1) {
    // Item exists, update quantity
    stockData[itemIndex].quantity += quantity;
  } else {
    // Item doesn't exist, add it
    stockData.push({ size, quantity });
  }
  
  // Save updated stock data
  saveStockData(section, stockData);
  
  // Log transaction
  logTransaction({
    section,
    size,
    quantity,
    type: 'IN'
  });
  
  res.json({ success: true, stockData });
});

// Stock out route
app.post('/stock/out', (req, res) => {
  const { section, size, quantity } = req.body;
  
  if (!section || !size || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid input data' });
  }
  
  if (!sections.includes(section)) {
    return res.status(400).json({ error: 'Invalid section' });
  }
  
  // Get current stock data
  const stockData = getStockData(section);
  
  // Find the item
  const itemIndex = stockData.findIndex(item => item.size === size);
  
  if (itemIndex === -1) {
    return res.status(400).json({ error: 'Item not found in stock' });
  }
  
  // Check if we have enough stock
  if (stockData[itemIndex].quantity < quantity) {
    return res.status(400).json({ error: 'Not enough stock available' });
  }
  
  // Update quantity
  stockData[itemIndex].quantity -= quantity;
  
  // Save updated stock data
  saveStockData(section, stockData);
  
  // Log transaction
  logTransaction({
    section,
    size,
    quantity,
    type: 'OUT'
  });
  
  res.json({ success: true, stockData });
});

// Upload CSV route
app.post('/upload', upload.single('file'), (req, res) => {
  const { section } = req.body;
  
  if (!section || !sections.includes(section)) {
    return res.status(400).json({ error: 'Invalid section' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const results = [];
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      // CSV format should have 'size' and 'quantity' columns
      results.push({
        size: parseInt(data.size),
        quantity: parseInt(data.quantity)
      });
    })
    .on('end', () => {
      // Update stock data
      const stockData = getStockData(section);
      
      results.forEach(item => {
        if (isNaN(item.size) || isNaN(item.quantity)) {
          return;
        }
        
        const itemIndex = stockData.findIndex(stock => stock.size === item.size);
        
        if (itemIndex !== -1) {
          // Item exists, update quantity
          stockData[itemIndex].quantity = item.quantity;
        } else {
          // Item doesn't exist, add it
          stockData.push({ size: item.size, quantity: item.quantity });
        }
        
        // Log transaction
        logTransaction({
          section,
          size: item.size,
          quantity: item.quantity,
          type: 'UPLOAD'
        });
      });
      
      // Save updated stock data
      saveStockData(section, stockData);
      
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      
      res.json({ success: true, stockData });
    });
});

// Get transaction logs
app.get('/logs', (req, res) => {
  try {
    const logData = fs.readFileSync(logFilePath, 'utf8');
    const transactions = JSON.parse(logData);
    res.json(transactions);
  } catch (error) {
    console.error('Error reading transaction logs:', error);
    res.status(500).json({ error: 'Failed to read transaction logs' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
