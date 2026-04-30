<div align="center">

# 🤖 WhatsApp AI Moderator

**Autonomous AI-powered WhatsApp group moderator that detects and eliminates commercial spam — including inside images.**

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Baileys](https://img.shields.io/badge/Baileys-WA%20Web%20API-25D366?style=flat-square&logo=whatsapp)](https://github.com/WhiskeySockets/Baileys)
[![AI Powered](https://img.shields.io/badge/AI-LLaMA%203.3%20%2B%20Qwen%20Vision-blueviolet?style=flat-square)](https://openrouter.ai)

> Built for Venezuelan and Latin American diaspora WhatsApp communities — but works for **any group** that needs to stay vendor-free.

</div>

---

## 🎯 The Problem

WhatsApp community groups get flooded with:
- 💸 Remittance & money transfer ads 
- 👟 Product sales 
- ✈️ Flight tickets & tours
- 📢 Business promotions and spam links

Standard bots only catch **text** keywords. Vendors learned to **send images instead** — a photo of a price list, a remittance ad, a product catalog — because bots can't read images.

**WhatsApp AI Moderator solves this with Vision AI.**

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| 🖼️ **Vision AI** | Analyzes image content using Qwen Vision — detects ads, price lists, remittance flyers, product catalogs |
| 🧠 **Context-aware NLP** | Uses LLaMA 3.3 70B to distinguish *"where can I buy shoes?"* from *"selling shoes, DM me"* |
| ⏱️ **Human-like delays** | Waits 1–3 min (day) or 5–15 min (night) before acting — avoids WhatsApp bot detection |
| ⚠️ **Warning system** | Configurable warnings before expulsion (1 in strict, 2 in moderate mode) |
| 🗑️ **Auto-delete** | Removes the offending message before sending the warning |
| 🚫 **Auto-expel** | Removes repeat offenders from the group |
| 📋 **Private reports** | Admins request sanction history via DM — never exposed in the group |
| 🔐 **Admin commands** | Full moderation toolkit usable only by group admins |
| 🌍 **Multi-group** | One bot instance monitors multiple groups simultaneously |

---

## 🚀 How It Works

```
User sends a message or image
        │
        ▼
┌───────────────────┐
│  Local filters    │  ← Instant, free: phishing links, spam patterns,
│  (regex + DB)     │    custom word list, commercial URLs
└────────┬──────────┘
         │ suspicious?
         ▼
┌───────────────────┐
│   Vision AI       │  ← For images: Qwen Vision analyzes the actual
│  (OpenRouter)     │    visual content (price lists, ads, flyers)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│   Text AI         │  ← For text: LLaMA 3.3 70B understands context,
│  (Together AI)    │    intent and nuance
└────────┬──────────┘
         │ violation detected
         ▼
┌───────────────────┐
│  Random delay     │  ← 1–3 min during day, 5–15 min at night
│  (anti-detection) │
└────────┬──────────┘
         │
         ▼
    Delete message + Warn user (or expel if repeat offender)
```

---

## 📦 Prerequisites

- **Node.js** v18 or higher
- **A dedicated WhatsApp number** (a SIM card you don't use for anything else)
- **Together AI account** → [api.together.ai](https://api.together.ai) (free tier available)
- **OpenRouter account** → [openrouter.ai](https://openrouter.ai) (~$0.25/1M tokens for vision)

> 💡 **Cost estimate:** Analyzing 1,000 images/month costs approximately $0.25–0.40 USD. Text analysis is virtually free.

---

## 🛠️ Installation

```bash
# 1. Clone the repository
git clone https://github.com/black-hak/whatsapp-ai-moderator
cd whatsapp-ai-moderator

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
nano .env   # Add your API keys

# 4. Start the bot (scan QR code on first run)
node src/index.js
```

On first run, a QR code will appear in the terminal. Scan it with WhatsApp on your dedicated phone number:
**WhatsApp → Settings → Linked Devices → Link a Device**

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and fill in your values:

```env
# Together AI — text analysis
AI_API_URL=https://api.together.xyz/v1/chat/completions
AI_API_KEY=your_together_ai_key_here
AI_MODEL=meta-llama/Llama-3.3-70B-Instruct-Turbo

# OpenRouter — vision AI (image analysis)
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_VISION_MODEL=qwen/qwen3.6-flash

# Bot settings
BOT_NAME=Simon
BOT_MODE=moderate        # strict | moderate | observer
CMD_PREFIX=!
```

### Moderation Modes

| Mode | Warnings before expulsion | Use case |
|------|--------------------------|----------|
| `strict` | 1 | Zero tolerance |
| `moderate` | 2 | Recommended — gives users one chance |
| `observer` | ∞ | Silent monitoring only, no action |

---

## 💬 Commands

### In the group (admins only)

| Command | Description |
|---------|-------------|
| `!modo strict\|moderate\|observer` | Change moderation mode |
| `!ban @user [reason]` | Manually remove a user |
| `!whitelist @user` | Exempt a user from moderation |
| `!resetadv @user` | Clear a user's warning count |
| `!addpalabra <word>` | Add a word to the local blacklist |
| `!ping` | Check if the bot is online |
| `!ayuda` | Show command list |

### Via private DM to the bot

| Command | Description |
|---------|-------------|
| `!historial` | Receive a private sanction report for all your groups |
| `!ayuda` | Show available commands |

> 🔒 The `!historial` command only works in private — sanction reports are never exposed in the group chat.

---

## 🖥️ Running in Production (VPS)

For 24/7 operation, use [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start src/index.js --name whatsapp-moderator
pm2 save
pm2 startup   # Auto-start on server reboot

# Log rotation (prevents disk fill-up)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 🌐 What Gets Detected

The bot blocks content in **Spanish, Portuguese, and English**, including:

- Remittance services: *"remesas", "tasas de cambio", "envío de dinero", "Zelle", "PIX"*
- Product sales: *"vendo", "oferta", "precio especial", "contactame", "pedidos"*
- Travel: *"pasajes", "vuelos", "excursiones", "paquetes"*
- Business promotion: phishing links, URL shorteners, commercial domains
- **Images**: price lists, promotional flyers, service ads — analyzed visually by AI

---

## 🤝 Contributing

Pull requests are welcome! Some ideas for contributions:
- [ ] Support for video analysis (frame extraction)
- [ ] Web dashboard for sanction management
- [ ] Telegram version
- [ ] Multi-language support (Portuguese, English)
- [ ] Docker image

---

## ⚠️ Disclaimer

This project uses the unofficial WhatsApp Web API via [Baileys](https://github.com/WhiskeySockets/Baileys). Use a dedicated phone number, not your personal one. WhatsApp may ban accounts that violate their Terms of Service.

---

## 📄 License

MIT © [black-hak](https://github.com/black-hak)

---

<div align="center">

**⭐ If this helps your community, please star the repo!**

*Built with ❤️ for every community tired of spam.*

</div>
