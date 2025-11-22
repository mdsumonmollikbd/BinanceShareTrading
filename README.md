<div align="center">
<img width="1200" height="475" alt="Whales Pump Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Whales Pump Share Trading - AI Support System

A sophisticated AI-powered support application designed for "Whales Pump Share Trading". It functions as both a standalone Web App and a Telegram Mini App, featuring a WhatsApp-style interface and advanced business logic powered by Google Gemini.

## 🚀 Key Features List

### 🤖 Artificial Intelligence & Logic
*   **Powered by Google Gemini 2.5:** Utilizes the latest Gemini models for high-accuracy text and audio processing.
*   **Islamic Business Persona:** The AI is strictly instructed to follow Islamic business etiquette (Adab), starting conversations with "Assalamu Alaikum" and maintaining a polite, humble tone.
*   **Strict Scope Control:** The AI refuses to discuss topics outside of Whales Pump business (e.g., politics, weather).
*   **Automated Eligibility Check:** Custom tool integration to check if a user qualifies for Share Trading based on capital (Minimum $5,000).
*   **Profit Calculator:** Built-in tool to calculate the 50/50 profit split for Share Trading partners.

### 📱 User Interface (UI) & Experience (UX)
*   **WhatsApp Dark Mode Replica:** Pixel-perfect design matching WhatsApp's dark theme, including colors (`#111b21`, `#00a884`), message bubbles, delivery ticks, and typography.
*   **Responsive Design:** Optimized for mobile devices and functions seamlessly as a Telegram Mini App (Full Screen).
*   **Dynamic Visualizer:** Real-time audio wave visualization during live calls.
*   **Custom Emoji Picker:** Integrated WhatsApp-style emoji keyboard.

### 💬 Communication Channels
*   **Text Chat:** Real-time streaming text chat with the AI agent.
*   **Live Voice Call:** Bidirectional, low-latency voice conversation using Gemini Live API (WebSockets).
*   **Voice Notes:** Users can record and send audio messages (Voice Notes), which the AI listens to and transcribes.
*   **Image Analysis (Screenshot Verification):** Users can upload screenshots of their Binance/Futures account. The AI analyzes the image to verify if the balance exceeds $5,000 before unlocking VIP contact details.

### 💼 Business Rules & Packages
*   **VIP Membership (Signals):**
    *   1 Month: $300
    *   3 Months: $600
    *   6 Months: $800
    *   12 Months: $1000
*   **Share Trading (Partnership):**
    *   Requires verified $5,000+ capital.
    *   50/50 Profit split model.
*   **Security Protocol:** The Admin Telegram ID (`@Binance_Share_Trading`) is **hidden** by default. It is only revealed if:
    1. The user confirms a VIP purchase.
    2. The user uploads a valid screenshot proving $5,000+ balance.

### 🤖 Telegram Bot Integration
*   **Mini App Launcher:** The bot replaces standard chat interaction with a persistent "Live Support Center" button to launch the Web App.
*   **Webhook Support:** Serverless backend (Netlify Functions) to handle Telegram Webhooks.
*   **Redirection Logic:** If a user types in the bot, they are automatically instructed to use the Mini App interface.

---

## 🛠 Tech Stack

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS
*   **Icons:** Lucide React, Font Awesome
*   **AI Provider:** Google GenAI SDK (@google/genai)
*   **Backend/Serverless:** Netlify Functions
*   **Deployment:** Netlify

---

## ⚙️ Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file or set in your deployment provider:
   *   `API_KEY`: Your Google Gemini API Key.
   *   `TELEGRAM_BOT_TOKEN`: Your Telegram Bot Token (from BotFather).

3. **Run Locally:**
   ```bash
   npm run dev
   ```

4. **Deploy to Netlify:**
   *   Connect GitHub repository.
   *   Set Environment Variables in Netlify Dashboard.
   *   Set Telegram Webhook:
       `https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://<YOUR_APP_URL>/.netlify/functions/bot`
