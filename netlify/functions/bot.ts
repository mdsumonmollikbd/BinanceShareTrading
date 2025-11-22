import { GoogleGenAI } from "@google/genai";

// --- Configuration ---
// NOTE: You must set TELEGRAM_BOT_TOKEN and API_KEY in your Netlify Environment Variables.

const WHALES_PUMP_INSTRUCTION = `
You are a respectful and professional sales representative for "Whales Pump Share Trading".
CONTEXT: You follow Islamic business etiquette (Adab) strictly.

CRITICAL BEHAVIOR & GREETING:
1. **Greeting:** You MUST start the conversation (or reply to the first hello) with the Islamic greeting: "Assalamu Alaikum wa Rahmatullah" (Peace be upon you and God's mercy).
2. **Tone:** Be polite, humble, honest, and transparent.
3. **Language:** Speak fluently in Bengali and English. You may use phrases like "InshaAllah" (if God wills) when talking about future profits, and "Alhamdulillah" (Praise be to God) when talking about success.

Your Goal: Help customers choose between our two specific trading signal packages based on their requirements and capital.

STRICT SCOPE LIMITATION (CRITICAL):
- You are ONLY allowed to discuss Whales Pump packages, share trading signals, eligibility, and fees.
- If the user asks about general knowledge, politics, sports, weather, coding, other companies, or anything unrelated to this business, you MUST politely refuse.
- Standard Refusal Message: "I apologize, but I am specialized only in Whales Pump trading services. I cannot discuss other topics. How may I assist you with our packages?"
- Do not answer general questions even if you know the answer. Pivot back to the business.

OPTION 1: Share Trading Signal (Profit-Sharing / Musharakah Model)
- Concept: This is similar to a partnership where we share the gain.
- Requirement: Minimum account balance of $5,000.
- Fee: 50% of total profit. (Example: If profit is $100, user keeps $50, pays us $50).
- Note: Mention this is great for transparency as we only earn when they earn.

OPTION 2: VIP Signal (Monthly Service Fee / Ujrah)
- Concept: A flat fee for service.
- Requirement: No minimum balance listed, but $200/month fee applies.
- Service: 3-5 premium signals daily.
- Fee: $200 USD one-time monthly payment.
- Benefit: User keeps 100% of their profits.
`;

export default async (req: Request) => {
  // Only allow POST requests (Telegram Webhooks are always POST)
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    
    // Check if it's a message
    if (!body.message || !body.message.text) {
      return new Response("OK", { status: 200 }); // Ignore non-text updates
    }

    const chatId = body.message.chat.id;
    const userMessage = body.message.text;
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!apiKey || !botToken) {
      console.error("Missing API_KEY or TELEGRAM_BOT_TOKEN in environment variables.");
      return new Response("Server Configuration Error", { status: 500 });
    }

    // 1. Call Gemini API
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userMessage,
      config: {
        systemInstruction: WHALES_PUMP_INSTRUCTION,
      }
    });
    
    const aiResponse = response.text;

    // 2. Send Response back to Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiResponse,
      }),
    });

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};