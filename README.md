# IPO Notification Server

A minimal Express server that fetches IPO data and sends Telegram notifications for IPOs closing today.

## Features

- Fetches live IPO data from https://api.ipoalerts.in/ipos?status=Open
- Filters IPOs closing today based on IST (Asia/Kolkata) timezone
- Sends formatted Telegram messages with Markdown V2
- Prevents duplicate notifications with in-memory deduplication
- Handles both `endDate` field and `schedule` array for closing dates
- Robust error handling for API failures

## Requirements

- Node.js (v14 or higher)
- A Telegram Bot Token
- A Telegram Chat ID

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd test-hsts
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
PORT=3000
```

## Usage

### Running the Server

```bash
npm start
```

The server will start on the configured PORT (default: 3000).

### Endpoints

#### `GET /`
Health check endpoint that returns server status.

**Response:**
```json
{
  "status": "running",
  "endpoints": [
    "GET /notify-ipo - Fetch and notify IPOs closing today"
  ]
}
```

#### `GET /notify-ipo`
Fetches IPO data and sends Telegram notifications for IPOs closing today.

**Response (when IPOs found):**
```json
{
  "sent": true,
  "count": 2,
  "ipos": [
    {
      "id": "68828091",
      "name": "Fujiyama Power Systems Limited",
      "symbol": "UTLSOLAR",
      "closingDate": "2025-11-17"
    }
  ]
}
```

**Response (when no IPOs closing today):**
```json
{
  "sent": false,
  "count": 0,
  "ipos": [],
  "message": "No IPOs closing today"
}
```

## How It Works

1. **Fetch IPO Data**: Retrieves open IPOs from the API
2. **Date Extraction**: Extracts closing date from `endDate` or `schedule` array
3. **Date Filtering**: Compares closing dates with today's date in IST timezone
4. **Deduplication**: Tracks sent IPOs in-memory to prevent duplicate notifications
5. **Telegram Notification**: Formats and sends message with Markdown V2 escaping
6. **Response**: Returns JSON with operation results

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Your Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | The chat ID where notifications will be sent |
| `PORT` | No | Server port (default: 3000) |

## Getting Telegram Credentials

### Bot Token
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the instructions
3. Copy the bot token provided

### Chat ID
1. Start a chat with your bot
2. Send a message
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find the `chat.id` in the response

## Dependencies

- **express**: Web framework for Node.js
- **axios**: HTTP client for API requests
- **dayjs**: Date manipulation with timezone support
  - `dayjs/plugin/utc`: UTC timezone plugin
  - `dayjs/plugin/timezone`: Timezone conversion plugin
  - `dayjs/plugin/customParseFormat`: Custom date parsing plugin

## License

ISC
