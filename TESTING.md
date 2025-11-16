# Manual Testing Guide

This document provides step-by-step instructions for manually testing the IPO Notification Server.

## Prerequisites

1. Node.js 18+ installed
2. A Telegram bot token (get from [@BotFather](https://t.me/botfather))
3. Your Telegram chat ID

### Getting Your Telegram Chat ID

1. Start a chat with your bot on Telegram
2. Send any message to the bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":YOUR_CHAT_ID}` in the response

## Setup

```bash
# Clone and install dependencies
cd /home/runner/work/test-hsts/test-hsts
npm install

# Create .env file
cp .env.example .env

# Edit .env and add your credentials
# TELEGRAM_BOT_TOKEN=your_actual_token_here
# TELEGRAM_CHAT_ID=your_actual_chat_id_here
# PORT=3000
```

## Test Cases

### Test 1: Server Startup Without Credentials

**Purpose**: Verify the server starts and shows warning when credentials are missing.

```bash
# Start server without env vars
node app.js
```

**Expected Output**:
```
Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variable.
Server will start but /notify-ipo endpoint will return 500 until configured.
IPO Notification Server listening on port 3000
```

**Test endpoint**:
```bash
curl http://localhost:3000/notify-ipo
```

**Expected Response**:
```json
{"error":"Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars"}
```

### Test 2: Server Startup With Valid Credentials

**Purpose**: Verify the server starts successfully with credentials.

```bash
# Start server with credentials
TELEGRAM_BOT_TOKEN=your_token TELEGRAM_CHAT_ID=your_chat_id node app.js
```

**Expected Output**:
```
IPO Notification Server listening on port 3000
```

### Test 3: Fetch IPO Data and Send Notification

**Purpose**: Test the complete flow of fetching, filtering, and sending.

**Setup**: Server must be running with valid credentials.

```bash
# In another terminal
curl http://localhost:3000/notify-ipo
```

**Expected Behaviors**:

**Scenario A: No IPOs closing today**
```json
{
  "sent": false,
  "sentTo": "your_chat_id",
  "count": 0,
  "ipos": []
}
```

**Scenario B: IPOs found and sent**
```json
{
  "sent": true,
  "sentTo": "your_chat_id",
  "count": 2,
  "ipos": [
    {
      "name": "Company Name",
      "issue_code": "CODE",
      "close_date": "2025-11-16",
      ...
    }
  ]
}
```

**Check your Telegram**: You should receive a message like:
```
*IPOs closing today (2025-11-16 IST):*

*Company Name* - `CODE`
_open:_ 2025-11-10
_close:_ 2025-11-16
[Source](https://example.com)
```

### Test 4: Deduplication

**Purpose**: Verify that duplicate IPOs are not sent twice.

**Setup**: After successfully sending notification in Test 3.

```bash
# Call endpoint again immediately
curl http://localhost:3000/notify-ipo
```

**Expected Response**:
```json
{
  "sent": false,
  "sentTo": "your_chat_id",
  "count": 0,
  "ipos": [...]
}
```

**Expected Server Logs**:
```
Skipping already-sent IPO id=<some_id>
All closing IPOs were already sent earlier.
```

**Check Telegram**: No new message should be sent.

### Test 5: API Error Handling

**Purpose**: Test behavior when external API is unreachable.

**Setup**: Block access to api.ipoalerts.in or use invalid credentials.

```bash
# Start with valid credentials but in a restricted network
node app.js
```

```bash
# Call endpoint
curl http://localhost:3000/notify-ipo
```

**Expected Response** (5xx error):
```json
{
  "error": "Failed to fetch/send IPO notifications",
  "details": {
    "message": "getaddrinfo ENOTFOUND api.ipoalerts.in"
  }
}
```

### Test 6: Invalid Telegram Credentials

**Purpose**: Test behavior when Telegram API rejects the request.

**Setup**: Use invalid bot token.

```bash
TELEGRAM_BOT_TOKEN=invalid_token TELEGRAM_CHAT_ID=123 node app.js
```

```bash
# Call endpoint (assuming API is reachable and IPOs exist)
curl http://localhost:3000/notify-ipo
```

**Expected Response** (401 or 400):
```json
{
  "error": "Failed to fetch/send IPO notifications",
  "details": {
    "message": "Request failed with status code 401",
    "apiError": {
      "ok": false,
      "error_code": 401,
      "description": "Unauthorized"
    }
  }
}
```

### Test 7: Date Parsing

**Purpose**: Verify robust date parsing works with different formats.

This is tested automatically by the `safeExtractCloseDate` function which tries:
- Multiple field names: `close_date`, `last_date`, `last_date_of_subscription`, etc.
- Multiple formats: `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `DD MMM YYYY`, etc.

**Manual Verification**: Check server logs when IPOs are fetched to see which dates were successfully parsed.

### Test 8: Environment Variable Configuration

**Purpose**: Test different PORT configurations.

```bash
# Test custom port
PORT=8080 TELEGRAM_BOT_TOKEN=token TELEGRAM_CHAT_ID=id node app.js
```

**Expected Output**:
```
IPO Notification Server listening on port 8080
```

```bash
# Test endpoint on custom port
curl http://localhost:8080/notify-ipo
```

## Monitoring and Logs

While server is running, observe console logs for:

```
IPO Notification Server listening on port 3000
Fetching IPO data...
Fetched 5 items from API.
Filtering for IPOs closing today (2025-11-16 IST)...
Found 2 IPO(s) closing today.
Sending Telegram message for 2 IPO(s)...
Successfully sent Telegram notification.
```

## Common Issues

### Issue: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID"
**Solution**: Set environment variables correctly before starting server.

### Issue: "getaddrinfo ENOTFOUND api.ipoalerts.in"
**Solution**: Check internet connectivity and firewall settings.

### Issue: Telegram API returns 401 Unauthorized
**Solution**: Verify bot token is correct from @BotFather.

### Issue: No messages received on Telegram
**Solution**: 
1. Verify chat ID is correct
2. Ensure bot has been started (send /start to bot)
3. Check if bot is blocked or removed from group

### Issue: Parse errors in Telegram message
**Solution**: Check that escapeMarkdownV2 function is properly escaping all special characters.

## Performance Testing

For high-load scenarios, consider:

```bash
# Multiple concurrent requests
for i in {1..10}; do
  curl http://localhost:3000/notify-ipo &
done
wait
```

**Expected**: All requests complete successfully, deduplication prevents duplicate sends.

## Security Verification

1. **Check logs don't expose secrets**:
   - Bot token should NEVER appear in logs
   - Only error messages, no credentials

2. **Verify input sanitization**:
   - All IPO data is escaped before sending to Telegram
   - Special characters in company names don't break MarkdownV2

3. **Test error responses**:
   - Errors don't leak sensitive information
   - Stack traces are not exposed to clients

## Cleanup

```bash
# Stop the server
Ctrl+C

# Remove test .env file if needed
rm .env
```

## Automated Testing (Future)

Consider adding:
- Unit tests for date parsing function
- Integration tests with mocked API responses
- End-to-end tests with test Telegram bot
- CI/CD pipeline with automated security scans
