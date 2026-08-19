# 💬 WhatsApp Auto Greeting Agent (Good Morning / Good Night)

An automated WhatsApp Agent built with **Node.js** and **whatsapp-web.js**, featuring a modern **Web Dashboard** to monitor live chats, customize positive English greeting templates, and scan the login QR code.

---

## ✨ Features

- **☀️ Morning Auto-Responder**: Detects incoming "Good Morning", "gm", "subho sokal" messages (5:00 AM – 12:00 PM) and sends warm, encouraging English greetings.
- **🌙 Night Auto-Responder**: Detects incoming "Good Night", "gn", "subho ratri" messages (8:00 PM – 4:00 AM) and sends peaceful, sweet dreams English greetings.
- **🌐 Glassmorphism Web Dashboard**: Access `http://localhost:3000` (or Cloud URL) to scan QR code, view connection status, and monitor live activity logs.
- **⏱️ Anti-Spam Cooldown**: Per-contact 10-minute cooldown timer so contacts are not spammed if they send multiple messages.
- **🧪 Built-in Simulator**: Test greeting evaluation rules interactively right from the dashboard.
- **☁️ 24/7 Cloud Ready**: Deploy to Render.com or Railway for 100% free, 24/7 operation without needing your laptop to stay on!

---

## 🌐 24/7 Cloud Deployment (No Laptop Required!)

To keep the agent active **24/7** even when your laptop is turned OFF or you are away:

### Option A: Deploy to Render.com (100% Free)
1. Push this folder to a GitHub repository.
2. Go to **[Render.com](https://render.com)** and create a free account.
3. Click **New +** → **Web Service** → Connect your GitHub repo.
4. Select **Docker** environment (Render will automatically detect `Dockerfile` & `render.yaml`).
5. Click **Create Web Service**.
6. Render will build your app and give you a permanent web link (e.g., `https://whatsapp-bot.onrender.com`).
7. Open that link on your **Mobile Phone Browser**, scan the QR code using WhatsApp Linked Devices once, and you're done! Your bot will run 24/7 even when your laptop is powered off!

---

## 💻 Local Running Instructions

### Step 1: Open Terminal in Project Directory
```bash
cd C:\Users\sayan\Desktop\auto-respond
```

### Step 2: Start the Agent
```bash
npm start
```

### Step 3: Connect WhatsApp
1. Open browser: **`http://localhost:3000`**
2. Open WhatsApp on phone → Settings → Linked Devices → Link a Device.
3. Scan the QR code.
