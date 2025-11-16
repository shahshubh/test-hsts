// IPO Notification Server - Notifies about IPOs closing today via Telegram
import express from "express";
import axios from "axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import dotenv from "dotenv";

dotenv.config();
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_BASE = (token) => `https://api.telegram.org/bot${token}`;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variable.");
  console.error("Server will start but /notify-ipo endpoint will return 500 until configured.");
}

const app = express();
app.use(express.json());

// Simple in-memory dedupe for this process (resets on restart)
const sentToday = new Set();
let lastResetDate = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD");

// Helper to reset dedupe at midnight IST
function maybeResetDedupe() {
  const today = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD");
  if (today !== lastResetDate) {
    sentToday.clear();
    lastResetDate = today;
    console.log(`Dedupe reset for new day: ${today}`);
  }
}

function safeExtractCloseDate(item) {
  // Try several common keys and common date formats
  const candidates = [
    item.close_date,
    item.last_date,
    item.last_date_of_subscription,
    item.closeDate,
    item.lastDate,
    item.issue_close_date,
    item.last_date_of_application,
    item["last_date_of_subscription"],
    item["last_date_of_application"]
  ].filter(Boolean);

  const formats = [
    "YYYY-MM-DD",
    "DD-MM-YYYY",
    "DD/MM/YYYY",
    "YYYY/MM/DD",
    "DD MMM YYYY",
    "DD MMMM YYYY",
    "MMM DD, YYYY",
    "DD-MM-YY",
    "YYYY-MM-DDTHH:mm:ssZ",
    "YYYY-MM-DDTHH:mm:ss.SSSZ"
  ];

  for (const c of candidates) {
    for (const fmt of formats) {
      const d = dayjs.tz(c, fmt, "Asia/Kolkata");
      if (d.isValid()) return d;
    }
    // Try automatic parse fallback
    const auto = dayjs.tz(c, "Asia/Kolkata");
    if (auto.isValid()) return auto;
  }
  return null;
}

function escapeMarkdownV2(text = "") {
  // Basic escape for Telegram MarkdownV2 special chars
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

async function sendTelegramMessage(text) {
  const url = `${TELEGRAM_API_BASE(TELEGRAM_BOT_TOKEN)}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "MarkdownV2",
    disable_web_page_preview: true
  };
  return axios.post(url, payload, { timeout: 10000 });
}

app.get("/notify-ipo", async (req, res) => {
  maybeResetDedupe();

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({ error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars" });
  }

  try {
    console.log("Fetching IPO data...");
    const resp = await axios.get("https://api.ipoalerts.in/ipos?status=Open", { timeout: 10000 });
    const ipos = Array.isArray(resp.data) ? resp.data : (resp.data?.ipos || []);
    console.log(`Fetched ${ipos.length} items from API.`);

    const todayIST = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD");
    console.log(`Filtering for IPOs closing today (${todayIST} IST)...`);

    const closingToday = [];
    for (const item of ipos) {
      const d = safeExtractCloseDate(item);
      if (!d) continue;
      const dateOnly = d.tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (dateOnly === todayIST) {
        closingToday.push({ raw: item, closeDate: d.format() });
      }
    }

    console.log(`Found ${closingToday.length} IPO(s) closing today.`);

    if (closingToday.length === 0) {
      console.log("No IPOs closing today - skipping Telegram notification.");
      return res.json({ sent: false, sentTo: TELEGRAM_CHAT_ID, count: 0, ipos: [] });
    }

    // Build message text
    const lines = [`*IPOs closing today \\(${escapeMarkdownV2(todayIST)} IST\\):*`, ""];
    const toSendIds = [];
    for (const entry of closingToday) {
      const item = entry.raw;
      const id = item.id ?? item.issue_code ?? item.code ?? item.name ?? JSON.stringify(item).slice(0, 50);
      if (sentToday.has(id)) {
        console.log(`Skipping already-sent IPO id=${id}`);
        continue;
      }
      toSendIds.push(id);

      const name = escapeMarkdownV2(item.name || item.company_name || "Unknown");
      const code = escapeMarkdownV2(item.issue_code || item.code || "");
      const open = escapeMarkdownV2(item.open_date || item.openDate || "");
      const close = escapeMarkdownV2(item.close_date || item.last_date || entry.closeDate || "");
      const url = item.url || item.link || "";

      let line = `*${name}*`;
      if (code) line += ` \\- \`${code}\``;
      if (open) line += `\n_open:_ ${open}`;
      if (close) line += `\n_close:_ ${close}`;
      if (url) line += `\n[Source](${escapeMarkdownV2(url)})`;
      lines.push(line, "");
    }

    if (toSendIds.length === 0) {
      console.log("All closing IPOs were already sent earlier.");
      return res.json({ sent: false, sentTo: TELEGRAM_CHAT_ID, count: 0, ipos: closingToday.map(c => c.raw) });
    }

    const message = lines.join("\n");

    // Send to Telegram
    console.log(`Sending Telegram message for ${toSendIds.length} IPO(s)...`);
    await sendTelegramMessage(message);

    // Mark as sent
    for (const id of toSendIds) sentToday.add(id);

    console.log(`Successfully sent Telegram notification.`);
    return res.json({ sent: true, sentTo: TELEGRAM_CHAT_ID, count: toSendIds.length, ipos: closingToday.map(c => c.raw) });

  } catch (err) {
    console.error("Error in /notify-ipo:", err?.message ?? err);
    const status = err.response?.status || 500;
    const errorDetails = {
      message: err.message,
      ...(err.response?.data && { apiError: err.response.data })
    };
    return res.status(status).json({ error: "Failed to fetch/send IPO notifications", details: errorDetails });
  }
});

app.listen(PORT, () => console.log(`IPO Notification Server listening on port ${PORT}`));

