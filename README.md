# IPO Notification Server

A production-ready Express server that fetches IPO data and sends Telegram notifications for IPOs closing today (in IST timezone).

## Features

- 🔔 Fetches IPO data from https://api.ipoalerts.in/ipos?status=Open
- 📅 Filters IPOs closing today based on Asia/Kolkata timezone
- 📱 Sends formatted notifications to Telegram
- 🔄 In-memory deduplication to avoid sending duplicate notifications
- ⚡ Robust date parsing supporting multiple formats
- 🛡️ Proper error handling and logging
- 🔒 Environment variable validation

## Prerequisites

- Node.js 18+ (tested on Node 20)
- A Telegram bot token (get it from [@BotFather](https://t.me/botfather))
- A Telegram chat ID (your user ID or group chat ID)

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory (or set environment variables):

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
PORT=3000
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | - | Your Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | ✅ Yes | - | Telegram chat ID (numeric or string) |
| `PORT` | ❌ No | 3000 | Server port |

## Usage

### Start the Server

```bash
# With environment variables
TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy node app.js

# Or with .env file
npm start
```

### Trigger Notification

Make a GET request to the `/notify-ipo` endpoint:

```bash
curl http://localhost:3000/notify-ipo
```

### Response Format

**Success (IPOs found and sent):**
```json
{
  "sent": true,
  "sentTo": "123456789",
  "count": 2,
  "ipos": [...]
}
```

**Success (no IPOs closing today):**
```json
{
  "sent": false,
  "sentTo": "123456789",
  "count": 0,
  "ipos": []
}
```

**Error (missing configuration):**
```json
{
  "error": "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars"
}
```

## How It Works

1. **Fetch IPO Data**: Retrieves open IPOs from the API with a 10-second timeout
2. **Parse Dates**: Robustly parses closing dates from multiple possible field names and formats
3. **Filter by Date**: Compares closing dates to today's date in Asia/Kolkata timezone (IST)
4. **Deduplication**: Tracks sent IPOs in memory to avoid duplicates during the same process run
5. **Format Message**: Creates a MarkdownV2-formatted message with IPO details
6. **Send to Telegram**: Posts the message to your configured Telegram chat
7. **Return Response**: Returns JSON with results and status

## Date Parsing

The server attempts to extract closing dates from multiple field names:
- `close_date`, `last_date`, `last_date_of_subscription`
- `closeDate`, `lastDate`, `issue_close_date`
- `last_date_of_application`

It supports these date formats:
- ISO: `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm:ssZ`
- Common: `DD-MM-YYYY`, `DD/MM/YYYY`
- Named: `DD MMM YYYY`, `DD MMMM YYYY`, `MMM DD, YYYY`

## Deduplication

IPOs are tracked by their ID (using `id`, `issue_code`, `code`, or `name` fields) in an in-memory Set. The Set is automatically cleared:
- At midnight IST
- When the server restarts

## Security Features

- ✅ Bot token is validated at startup but never logged in full
- ✅ All text interpolated into Telegram messages is escaped to prevent injection
- ✅ No secrets or sensitive data in responses
- ✅ Graceful error handling without exposing internals

## Logging

The server logs:
- Server startup on configured port
- IPO data fetch attempts and counts
- Date filtering results
- Deduplication decisions
- Telegram send results
- Errors with messages (no token exposure)

## Error Handling

- **Missing Environment Variables**: Returns 500 with clear error message
- **Network Failures**: Returns 5xx with timeout or connection error details
- **API Errors**: Returns appropriate status code from upstream API
- **Telegram Errors**: Returns 500 with error details (no token exposed)

## Manual Testing

### Test with curl
```bash
# Start server with test credentials
TELEGRAM_BOT_TOKEN=test123 TELEGRAM_CHAT_ID=456 node app.js

# In another terminal, make request
curl http://localhost:3000/notify-ipo
```

### Expected Behavior
- If no IPOs are closing today: Returns `{"sent": false, "count": 0, ...}`
- If IPOs are closing today and not sent before: Sends Telegram message and returns success
- If IPOs were already sent: Returns `{"sent": false, "count": 0, ...}` (deduped)

## Production Deployment

### Recommended Setup
1. Use environment variables (not .env file) for secrets
2. Deploy behind a reverse proxy (nginx, Caddy)
3. Set up monitoring/alerting on the endpoint
4. Consider adding a cron job or scheduler to call the endpoint daily
5. Use a process manager (PM2, systemd) to keep the server running

### Example with PM2
```bash
pm2 start app.js --name ipo-notifier
pm2 save
pm2 startup
```

## Dependencies

- **express**: Web framework
- **axios**: HTTP client for API requests
- **dayjs**: Date/time parsing and timezone handling
- **dotenv**: Environment variable management

## License

ISC
