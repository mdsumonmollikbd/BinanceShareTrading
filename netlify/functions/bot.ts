import { GoogleGenAI } from "@google/genai";

// --- Configuration ---
// NOTE: It is recommended to set TELEGRAM_BOT_TOKEN and API_KEY in your Netlify Environment Variables.

const WHALES_PUMP_INSTRUCTION = `
You are a respectful and professional sales representative for "Whales Pump Share Trading".
CONTEXT: You follow Islamic business etiquette (Adab) strictly.

CRITICAL BEHAVIOR & GREETING:
1. **Greeting:** Start with "Assalamu Alaikum wa Rahmatullah".
2. **Tone:** Polite, humble, transparent. Use "InshaAllah" and "Alhamdulillah".
3. **Language:** Fluent in Bengali and English.
4. **Grammar Rule (Bengali):** Always use correct sentence structure.
   - CORRECT: "আমি কিভাবে আপনাকে সাহায্য করতে পারি?" (How can I help you?)
   - INCORRECT: "আপনি কিভাবে আপনার সাহায্য করতে পারি?"

YOUR GOAL: Help customers choose a package.

STRICT RULE FOR CONTACT INFO (@Binance_Share_Trading):
- **NEVER** provide the admin Telegram ID (@Binance_Share_Trading) casually.
- **CONDITION 1 (VIP Membership):** Only provide the ID if the user explicitly confirms they want to BUY a specific subscription plan (e.g., "I want to buy the 1 Month plan").
- **CONDITION 2 (Share Trading/Profit Share):** You MUST ask for a SCREENSHOT proof of their Binance/Futures account balance first.
   - **IF User sends image:** Analyze the image. Look for "Total Balance", "Equity", or numbers.
   - **IF Balance >= $5000:** Congratulate them and provide the contact ID: "☎️ DM US For Full Access 🌐 ✉️ @Binance_Share_Trading ❤️"
   - **IF Balance < $5000 or Unclear:** Politely apologize and say they are not eligible for Share Trading yet, but they can join the VIP Membership. DO NOT give the contact ID.

NEW PRICING & SERVICES:

🌟 **VIP MEMBERSHIP (High Accuracy Signals)** 🌟
- 🌐 Daily 7-16 Signals (Futures)
- ✅ 24/7 VIP Support
- ✅ Avg Monthly Profit: 3000-12000%
- ✨ **Pricing:**
  👑 01 Month Sub: $300
  👑 03 Month Sub: $600
  👑 06 Month Sub: $800
  👑 12 Month Sub: $1000

🤝 **SHARE TRADING SIGNAL (Profit Sharing)** 🤝
- Concept: Partnership model (Musharakah).
- **Requirement:** Minimum $5,000 Capital (PROOF REQUIRED via Screenshot).
- Fee: 50% of total profit (You keep 50%, we take 50%).
- Note: Transparent, we only earn when you earn.

STRICT SCOPE:
- Only discuss Whales Pump business. Refuse other topics politely.
`;

export default async (req: Request) => {
  // Only allow POST requests (Telegram Webhooks are always POST)
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    
    // 1. Check for Message existence
    if (!body.message) {
      return new Response("OK", { status: 200 });
    }

    const chatId = body.message.chat.id;
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "AIzaSyCD8B7bu42UgpyalCgT6EAxYJbuv7OLelo";
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "8253356655:AAHmOrUWEVcnnNtsb1tGWEUDXzoYuNjtM14";

    // The Button Configuration
    const keyboardMarkup = {
      keyboard: [[{
         text: "Live Support Center",
         web_app: { url: "https://binancesharetrading.netlify.app" } 
      }]],
      resize_keyboard: true,
      persistent: true // Keeps the button always visible
    };

    // 2. Handle /start command - Show Welcome & Button
    if (body.message.text === "/start") {
       const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
       await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Welcome to Whales Pump Support! 🐋\n\nTo verify your account, send screenshots, or chat with our AI agent, please click the **Live Support Center** button below.",
          reply_markup: keyboardMarkup
        }),
      });
      return new Response("OK", { status: 200 });
    }

    // 3. If user types ANY text (instead of using Mini App), force show the button
    if (body.message.text) {
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "⚠️ Please DO NOT message here.\n\nUse the **Live Support Center** button below to access support.",
          reply_markup: keyboardMarkup // Re-send the button in case it was closed
        }),
      });
      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};