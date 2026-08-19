const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Application State
let agentState = {
  status: 'DISCONNECTED', // DISCONNECTED, INITIALIZING, QR_READY, AUTHENTICATED, READY
  autoReplyEnabled: true,
  qrCodeUrl: null,
  userInfo: null,
  stats: {
    totalReceived: 0,
    morningReplies: 0,
    nightReplies: 0,
    generalReplies: 0,
    lastActivity: null
  },
  settings: {
    activeChatPauseMinutes: 15, // Pause auto-reply if YOU reply in a chat
    botCooldownMinutes: 15,       // Don't repeat auto-reply to same contact within 15 mins
    timeFilterEnabled: true,
    morningStart: 5,  // 5:00 AM
    morningEnd: 12,   // 12:00 PM
    nightStart: 20,   // 8:00 PM
    nightEnd: 4       // 4:00 AM (next day)
  },
  templates: {
    morningBengali: [
      "শুভ সকাল! ☀️ আপনার আজকের দিনটি অনেক সুন্দর, আনন্দদায়ক ও সফল কাটুক! ✨"
    ],
    morningEnglish: [
      "Good morning! ☀️ Wishing you a wonderful, cheerful, and productive day ahead!"
    ],
    nightBengali: [
      "শুভ রাত্রি! 🌙 চমৎকার ও শান্তিময় ঘুম হোক, মিষ্টি স্বপ্ন দেখুন! 💤"
    ],
    nightEnglish: [
      "Good night! 🌙 Wishing you a peaceful sleep and sweet dreams!"
    ],
    general: [
      "Hello! 👋 Thanks for your message. I'm currently away or busy, but I've received your text and will get back to you soon! Have a great day! 😊"
    ]
  },
  logs: []
};

// Maps to track user activity & bot replies per contact
const lastUserSentMap = new Map(); // contactId -> timestamp when YOU sent a message
const lastBotRepliedMap = new Map(); // contactId -> timestamp when BOT sent auto-reply

// Helper to push logs and notify WebSockets
function addLog(type, title, message, details = null) {
  const logEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type, // 'info', 'success', 'warning', 'error', 'gm', 'gn', 'gen'
    title,
    message,
    details
  };
  agentState.logs.unshift(logEntry);
  if (agentState.logs.length > 100) agentState.logs.pop();
  agentState.stats.lastActivity = logEntry.timestamp;

  broadcast({
    type: 'LOG_ADDED',
    log: logEntry,
    stats: agentState.stats
  });
}

// Broadcast to all connected WebSocket clients
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Clean stale Chrome SingletonLock files that prevent Puppeteer from starting in Docker
function cleanStaleLockFiles() {
  try {
    const authPath = path.join(__dirname, '.wwebjs_auth', 'session');
    if (fs.existsSync(authPath)) {
      const files = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
      files.forEach(f => {
        const filePath = path.join(authPath, f);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned stale lock file: ${filePath}`);
        }
      });
    }
  } catch (err) {
    console.error('Warning cleaning lock files:', err.message);
  }
}

// Exact Evaluator Engine matching exact user requirements
function evaluateMessage(text) {
  if (!text) return { category: 'NONE', replyText: null, reason: 'Empty message' };

  const normalized = text.toLowerCase().trim();

  // 1. Bengali Morning Check ("শুভ সকাল", "সুপ্রভাত", "subho sokal")
  const morningBengaliKeywords = ['শুভ সকাল', 'সুপ্রভাত', 'শুভপ্রভাত', 'subho sokal', 'shubho sokal'];
  const isMorningBN = morningBengaliKeywords.some(kw => normalized.includes(kw) || text.includes(kw));

  if (isMorningBN) {
    const replyText = agentState.templates.morningBengali[0] || "শুভ সকাল! ☀️ আপনার আজকের দিনটি অনেক সুন্দর, আনন্দদায়ক ও সফল কাটুক! ✨";
    return { category: 'MORNING', replyText, reason: 'Matched Bengali Morning Greeting' };
  }

  // 2. English Morning Check ("good morning", "gm")
  const morningEnglishKeywords = ['good morning', 'goodmorning', 'gud morning', 'gudmorning', 'gm'];
  const isMorningEN = morningEnglishKeywords.some(kw => normalized.includes(kw));

  if (isMorningEN) {
    const replyText = agentState.templates.morningEnglish[0] || "Good morning! ☀️ Wishing you a wonderful, cheerful, and productive day ahead!";
    return { category: 'MORNING', replyText, reason: 'Matched English Morning Greeting' };
  }

  // 3. Bengali Night Check ("শুভ রাত্রি", "শুভরাত্রি", "subho ratri")
  const nightBengaliKeywords = ['শুভ রাত্রি', 'শুভরাত্রি', 'subho ratri', 'shubho ratri'];
  const isNightBN = nightBengaliKeywords.some(kw => normalized.includes(kw) || text.includes(kw));

  if (isNightBN) {
    const replyText = agentState.templates.nightBengali[0] || "শুভ রাত্রি! 🌙 চমৎকার ও শান্তিময় ঘুম হোক, মিষ্টি স্বপ্ন দেখুন! 💤";
    return { category: 'NIGHT', replyText, reason: 'Matched Bengali Night Greeting' };
  }

  // 4. English Night Check ("good night", "gn")
  const nightEnglishKeywords = ['good night', 'goodnight', 'gud night', 'gudnight', 'gn'];
  const isNightEN = nightEnglishKeywords.some(kw => normalized.includes(kw));

  if (isNightEN) {
    const replyText = agentState.templates.nightEnglish[0] || "Good night! 🌙 Wishing you a peaceful sleep and sweet dreams!";
    return { category: 'NIGHT', replyText, reason: 'Matched English Night Greeting' };
  }

  // 5. ANY OTHER QUESTION / MESSAGE ("hi", "hlw", "ki korchi", etc.)
  const replyText = agentState.templates.general[0] || "Hello! 👋 Thanks for your message. I'm currently away or busy, but I've received your text and will get back to you soon! Have a great day! 😊";
  return { category: 'GENERAL', replyText, reason: 'General Question/Message -> Sent Busy Auto-Reply' };
}

// Initialize WhatsApp Web Client with Ultra-Fast Low Memory Chrome Flags
let client = null;

function initWhatsAppClient() {
  cleanStaleLockFiles();

  addLog('info', 'Agent Starting', 'Initializing WhatsApp Web client with low-memory optimization...');
  agentState.status = 'INITIALIZING';
  broadcast({ type: 'STATE_UPDATE', state: agentState });

  const puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--js-flags=--expose-gc',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check'
  ];

  const clientOpts = {
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    qrMaxRetries: 10,
    puppeteer: {
      headless: true,
      args: puppeteerArgs
    }
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    clientOpts.puppeteer.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  client = new Client(clientOpts);

  client.on('qr', async (qr) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
      agentState.status = 'QR_READY';
      agentState.qrCodeUrl = qrDataUrl;
      addLog('warning', 'QR Code Ready', 'Scan the QR code from the Web Dashboard using WhatsApp Linked Devices');
      broadcast({ type: 'STATE_UPDATE', state: agentState });
    } catch (err) {
      console.error('Error generating QR Code Data URL:', err);
    }
  });

  client.on('authenticated', () => {
    agentState.status = 'AUTHENTICATED';
    agentState.qrCodeUrl = null;
    addLog('success', 'Authenticated', 'WhatsApp Web session authenticated successfully!');
    broadcast({ type: 'STATE_UPDATE', state: agentState });
  });

  client.on('ready', () => {
    agentState.status = 'READY';
    agentState.userInfo = client.info ? client.info.pushname || client.info.wid.user : 'WhatsApp User';
    addLog('success', 'Smart Agent Active 24/7', `WhatsApp Multi-Lingual Agent active for: ${agentState.userInfo}`);
    broadcast({ type: 'STATE_UPDATE', state: agentState });
  });

  client.on('auth_failure', (msg) => {
    agentState.status = 'DISCONNECTED';
    addLog('error', 'Auth Failed', `Authentication failed: ${msg}`);
    broadcast({ type: 'STATE_UPDATE', state: agentState });
  });

  client.on('disconnected', (reason) => {
    agentState.status = 'DISCONNECTED';
    agentState.qrCodeUrl = null;
    addLog('error', 'Disconnected', `WhatsApp disconnected: ${reason}`);
    broadcast({ type: 'STATE_UPDATE', state: agentState });
  });

  // Track ALL outgoing messages sent by YOU
  client.on('message_create', async (msg) => {
    try {
      if (msg.fromMe && !msg.isStatus && msg.to && !msg.to.includes('@g.us')) {
        const contactId = msg.to;
        lastUserSentMap.set(contactId, Date.now());
      }
    } catch (err) {
      console.error('Error tracking outgoing user message:', err);
    }
  });

  // Handle incoming messages from others
  client.on('message', async (msg) => {
    try {
      if (msg.fromMe || msg.isStatus || msg.from.includes('@g.us')) return;

      agentState.stats.totalReceived++;
      const contact = await msg.getContact();
      const senderName = contact.pushname || contact.name || contact.number || msg.from;
      const messageBody = msg.body;
      const contactId = msg.from;

      addLog('info', 'Incoming Message', `From ${senderName}: "${messageBody}"`);

      if (!agentState.autoReplyEnabled) {
        addLog('warning', 'Auto-Reply Disabled', `Received message from ${senderName}, but auto-responder is turned OFF.`);
        return;
      }

      const now = Date.now();

      // RULE 1: Check if YOU (the user) sent a message to this contact recently (Active Chat Check)
      const lastUserTime = lastUserSentMap.get(contactId) || 0;
      const activePauseMs = (agentState.settings.activeChatPauseMinutes || 15) * 60 * 1000;
      if (now - lastUserTime < activePauseMs) {
        const remainingMin = Math.ceil((activePauseMs - (now - lastUserTime)) / 60000);
        addLog('warning', '🤫 Chat Active (Auto-Paused)', `Skipping auto-reply for ${senderName} because YOU are actively chatting with them. Paused for ${remainingMin}m.`);
        return;
      }

      // RULE 2: Check if the BOT already sent an auto-reply to this contact recently
      const lastBotTime = lastBotRepliedMap.get(contactId) || 0;
      const botCooldownMs = (agentState.settings.botCooldownMinutes || 15) * 60 * 1000;
      if (now - lastBotTime < botCooldownMs) {
        const remainingMin = Math.ceil((botCooldownMs - (now - lastBotTime)) / 60000);
        addLog('warning', '⏱️ Auto-Reply Cooldown', `Skipping repeated auto-reply for ${senderName}. Bot already replied recently (Cooldown remaining: ${remainingMin}m).`);
        return;
      }

      const evalResult = evaluateMessage(messageBody);

      if (evalResult.category === 'MORNING') {
        await msg.reply(evalResult.replyText);
        lastBotRepliedMap.set(contactId, now);
        agentState.stats.morningReplies++;
        addLog('gm', '☀️ Morning Reply Sent', `Replied to ${senderName}: "${evalResult.replyText}"`);
      } else if (evalResult.category === 'NIGHT') {
        await msg.reply(evalResult.replyText);
        lastBotRepliedMap.set(contactId, now);
        agentState.stats.nightReplies++;
        addLog('gn', '🌙 Night Reply Sent', `Replied to ${senderName}: "${evalResult.replyText}"`);
      } else if (evalResult.category === 'GENERAL') {
        await msg.reply(evalResult.replyText);
        lastBotRepliedMap.set(contactId, now);
        agentState.stats.generalReplies++;
        addLog('gen', '💬 Busy Auto-Reply Sent', `Replied to ${senderName}: "${evalResult.replyText}"`);
      }

    } catch (err) {
      console.error('Error processing incoming WhatsApp message:', err);
      addLog('error', 'Processing Error', `Error handling message: ${err.message}`);
    }
  });

  client.initialize().catch(err => {
    addLog('error', 'Initialization Error', `Failed to initialize WhatsApp Web client: ${err.message}`);
    setTimeout(() => {
      console.log('Retrying WhatsApp Web client initialization after error...');
      initWhatsAppClient();
    }, 5000);
  });
}

// Serve Static Frontend Files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Express API Routes
app.get('/api/state', (req, res) => res.json(agentState));

app.post('/api/toggle-reply', (req, res) => {
  agentState.autoReplyEnabled = !agentState.autoReplyEnabled;
  addLog('info', 'Setting Changed', `Auto-Reply turned ${agentState.autoReplyEnabled ? 'ON' : 'OFF'}`);
  broadcast({ type: 'STATE_UPDATE', state: agentState });
  res.json({ success: true, autoReplyEnabled: agentState.autoReplyEnabled });
});

app.post('/api/settings', (req, res) => {
  const { activeChatPauseMinutes, botCooldownMinutes } = req.body;
  if (typeof activeChatPauseMinutes === 'number') agentState.settings.activeChatPauseMinutes = activeChatPauseMinutes;
  if (typeof botCooldownMinutes === 'number') agentState.settings.botCooldownMinutes = botCooldownMinutes;
  addLog('success', 'Settings Saved', `Active Chat Pause: ${agentState.settings.activeChatPauseMinutes}m, Bot Cooldown: ${agentState.settings.botCooldownMinutes}m`);
  broadcast({ type: 'STATE_UPDATE', state: agentState });
  res.json({ success: true, settings: agentState.settings });
});

app.post('/api/templates', (req, res) => {
  const { morningBengali, morningEnglish, nightBengali, nightEnglish, general } = req.body;
  if (Array.isArray(morningBengali)) agentState.templates.morningBengali = morningBengali;
  if (Array.isArray(morningEnglish)) agentState.templates.morningEnglish = morningEnglish;
  if (Array.isArray(nightBengali)) agentState.templates.nightBengali = nightBengali;
  if (Array.isArray(nightEnglish)) agentState.templates.nightEnglish = nightEnglish;
  if (Array.isArray(general)) agentState.templates.general = general;
  addLog('success', 'Templates Updated', 'Custom response templates saved successfully.');
  broadcast({ type: 'STATE_UPDATE', state: agentState });
  res.json({ success: true, templates: agentState.templates });
});

app.post('/api/simulate', (req, res) => {
  const { senderName = 'Test Friend', messageText } = req.body;
  agentState.stats.totalReceived++;
  const evalResult = evaluateMessage(messageText);

  if (evalResult.category === 'MORNING') {
    agentState.stats.morningReplies++;
    addLog('gm', '[SIMULATOR] Morning Reply', `[Simulated] From ${senderName}: "${messageText}" -> Replied: "${evalResult.replyText}"`);
  } else if (evalResult.category === 'NIGHT') {
    agentState.stats.nightReplies++;
    addLog('gn', '[SIMULATOR] Night Reply', `[Simulated] From ${senderName}: "${messageText}" -> Replied: "${evalResult.replyText}"`);
  } else if (evalResult.category === 'GENERAL') {
    agentState.stats.generalReplies++;
    addLog('gen', '[SIMULATOR] Auto-Reply', `[Simulated] From ${senderName}: "${messageText}" -> Replied: "${evalResult.replyText}"`);
  }

  res.json({ success: true, result: evalResult, stats: agentState.stats });
});

app.post('/api/reconnect', (req, res) => {
  if (client) {
    try { client.destroy(); } catch(e) {}
  }
  initWhatsAppClient();
  res.json({ success: true, message: 'Reconnecting WhatsApp client...' });
});

// Start Server explicitly binding to 0.0.0.0 for Docker containers
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Smart WhatsApp Agent active on port ${PORT}!`);
  console.log(`🌐 Dashboard URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
  initWhatsAppClient();
});
