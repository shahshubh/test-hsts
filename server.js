const express = require('express');
const axios = require('axios');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const app = express();

// In-memory set to track sent IPOs (deduplication)
const sentIPOs = new Set();

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PORT = process.env.PORT || 3000;

// Escape special characters for Telegram Markdown V2
function escapeMarkdownV2(text) {
  if (!text) return '';
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// Extract closing date from IPO object
function getClosingDate(ipo) {
  // Prefer endDate
  if (ipo.endDate) {
    return ipo.endDate;
  }
  
  // Fallback to schedule array
  if (ipo.schedule && Array.isArray(ipo.schedule)) {
    const closeEvent = ipo.schedule.find(
      event => event.event && event.event.toLowerCase().includes('close')
    );
    if (closeEvent && closeEvent.date) {
      return closeEvent.date;
    }
  }
  
  return null;
}

// Check if IPO closes today (IST timezone)
function isClosingToday(closingDate) {
  if (!closingDate) return false;
  
  const today = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD');
  const closeDate = dayjs(closingDate, 'YYYY-MM-DD').tz('Asia/Kolkata').format('YYYY-MM-DD');
  
  return today === closeDate;
}

// Build Telegram message for IPOs closing today
function buildTelegramMessage(ipos) {
  if (!ipos || ipos.length === 0) {
    return null;
  }
  
  let message = `🔔 *IPOs Closing Today*\n\n`;
  
  ipos.forEach((ipo, index) => {
    const name = escapeMarkdownV2(ipo.name || 'Unknown');
    const symbol = escapeMarkdownV2(ipo.symbol || 'N/A');
    const closingDate = escapeMarkdownV2(getClosingDate(ipo) || 'N/A');
    const infoUrl = ipo.infoUrl || '';
    
    message += `${index + 1}\\. *${name}*\n`;
    message += `   Symbol: ${symbol}\n`;
    message += `   Closing: ${closingDate}\n`;
    
    if (infoUrl) {
      message += `   [More Info](${infoUrl})\n`;
    }
    
    message += `\n`;
  });
  
  return message;
}

// Send Telegram message
async function sendTelegramMessage(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables');
  }
  
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  const response = await axios.post(url, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'MarkdownV2',
    disable_web_page_preview: false
  });
  
  return response.data;
}

// Main endpoint: GET /notify-ipo
app.get('/notify-ipo', async (req, res) => {
  try {
    // 1. Fetch IPO data from API
    const apiUrl = 'https://api.ipoalerts.in/ipos?status=Open';
    const response = await axios.get(apiUrl);
    
    if (!response.data || !response.data.ipos) {
      return res.status(500).json({
        error: 'Unexpected API response schema',
        sent: false,
        count: 0,
        ipos: []
      });
    }
    
    const allIPOs = response.data.ipos;
    
    // 2. Filter IPOs closing today (IST timezone)
    const iposClosingToday = allIPOs.filter(ipo => {
      const closingDate = getClosingDate(ipo);
      return closingDate && isClosingToday(closingDate);
    });
    
    // 3. Filter out already sent IPOs (deduplication)
    const newIPOsClosingToday = iposClosingToday.filter(ipo => {
      if (sentIPOs.has(ipo.id)) {
        return false;
      }
      return true;
    });
    
    // 4. If no IPOs closing today, return without sending
    if (newIPOsClosingToday.length === 0) {
      return res.json({
        sent: false,
        count: 0,
        ipos: [],
        message: iposClosingToday.length > 0 
          ? 'All IPOs closing today were already sent' 
          : 'No IPOs closing today'
      });
    }
    
    // 5. Build and send Telegram message
    const message = buildTelegramMessage(newIPOsClosingToday);
    
    if (!message) {
      return res.json({
        sent: false,
        count: 0,
        ipos: []
      });
    }
    
    await sendTelegramMessage(message);
    
    // 6. Mark IPOs as sent
    newIPOsClosingToday.forEach(ipo => {
      sentIPOs.add(ipo.id);
    });
    
    // 7. Return success response
    return res.json({
      sent: true,
      count: newIPOsClosingToday.length,
      ipos: newIPOsClosingToday.map(ipo => ({
        id: ipo.id,
        name: ipo.name,
        symbol: ipo.symbol,
        closingDate: getClosingDate(ipo)
      }))
    });
    
  } catch (error) {
    console.error('Error in /notify-ipo endpoint:', error.message);
    
    return res.status(500).json({
      error: error.message,
      sent: false,
      count: 0,
      ipos: []
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    endpoints: [
      'GET /notify-ipo - Fetch and notify IPOs closing today'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`IPO Notification Server listening on port ${PORT}`);
  console.log(`Environment check:`);
  console.log(`  - TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? '✓ Set' : '✗ Not set'}`);
  console.log(`  - TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID ? '✓ Set' : '✗ Not set'}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET / - Health check`);
  console.log(`  GET /notify-ipo - Fetch and notify IPOs closing today`);
});
