import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type, Chat } from '@google/genai';
import { ConnectionState } from '../types';
import Visualizer from './Visualizer';
import { 
  base64ToUint8Array, 
  pcmToAudioBuffer, 
  float32ToInt16Pcm, 
  arrayBufferToBase64 
} from '../utils/audioUtils';

// --- Types for Telegram WebApp ---
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        expand: () => void;
        ready: () => void;
      }
    }
  }
}

// --- Assets / Icons ---

const WhalesPumpLogo = ({ className, iconSize = "text-xl" }: { className?: string, iconSize?: string }) => (
  <div className={`flex items-center justify-center bg-gradient-to-br from-[#00a884] to-[#005c4b] text-white ${className}`}>
     <i className={`fa-solid fa-chart-line ${iconSize}`}></i>
  </div>
);

// --- Whales Pump Business Logic & Tool Definitions ---

const ELIGIBILITY_TOOL: FunctionDeclaration = {
  name: "check_eligibility",
  description: "Check which trading package the user is eligible for based on their capital.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      capital: {
        type: Type.NUMBER,
        description: "The user's available trading capital in USD."
      }
    },
    required: ["capital"]
  }
};

const PROFIT_CALCULATOR_TOOL: FunctionDeclaration = {
  name: "calculate_profit_share",
  description: "Calculate the fee split for Option 1 (Share Trading Signal).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      profit: {
        type: Type.NUMBER,
        description: "The potential profit amount in USD."
      }
    },
    required: ["profit"]
  }
};

const PROVIDE_CONTACT_TOOL: FunctionDeclaration = {
  name: "provide_admin_contact",
  description: "Trigger this action to display the Admin Telegram ID card on the user's screen. Use this ONLY when the user is verified eligible.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: "The reason for providing contact (e.g., 'VIP Purchase' or 'Balance Verified')."
      }
    },
    required: ["reason"]
  }
};

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

// Common Emojis List
const EMOJI_LIST = [
  "😀","😃","😄","😄","😆","😅","😂","🤣","🥲","☺️","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾",
  "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💅", "💪", "🧠", "🫀", "👀", "👁️",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "💯", "💢", "💥", "💫", "💦", "💨", "🕳", "💣", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤",
  "📈", "📉", "📊", "💲", "💰", "💸", "💵", "💶", "💷", "💳", "💎", "⚖️", "🕌", "🕋"
];

const LiveVoiceChat: React.FC = () => {
  // UI State: 'chat' | 'call'
  const [view, setView] = useState<'chat' | 'call'>('chat');

  // Voice Call State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Text/Voice Chat State
  const [textMessages, setTextMessages] = useState<any[]>([
    { id: 1, sender: 'agent', text: 'Assalamu Alaikum! Welcome to Whales Pump Share Trading. How can I help you with our packages today?', time: '10:00 AM' },
  ]);
  const [inputText, setInputText] = useState("");
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Recording State (Voice Note)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Audio Context Refs (Live Call)
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Playback queue management
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Session Management
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sessionRef = useRef<any>(null);
  const durationIntervalRef = useRef<any>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    if (view === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [textMessages, view, showEmojiPicker]);

  // Hide emoji picker if recording starts
  useEffect(() => {
    if (isRecording) setShowEmojiPicker(false);
  }, [isRecording]);

  // Check for Telegram Web App to expand
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.ready();
    }
  }, []);

  // --- Business Logic Executors ---
  const executeTool = async (name: string, args: any) => {
    console.log(`Executing business logic for: ${name}`, args);
    await new Promise(resolve => setTimeout(resolve, 200));

    if (name === 'check_eligibility') {
      const { capital } = args;
      if (capital >= 5000) {
        return { 
          result: "Eligible for Share Trading.",
          recommendation: "With over $5,000, you are eligible for our Share Trading (50/50 split). Please upload a screenshot of your balance for verification." 
        };
      } else {
        return { 
          result: "NOT Eligible for Share Trading.",
          recommendation: `Your capital ($${capital}) is below the $5,000 requirement for Share Trading. Please join our VIP Membership starting at $300.` 
        };
      }
    }

    if (name === 'calculate_profit_share') {
      const { profit } = args;
      const fee = profit * 0.5;
      const userKeep = profit * 0.5;
      return { 
        totalProfit: profit,
        ourFee: fee,
        userKeeps: userKeep,
        message: `For a profit of $${profit}, you will keep $${userKeep} and pay us $${fee} as service fee.`
      };
    }

    if (name === 'provide_admin_contact') {
      const contactMsg = { 
        id: Date.now(), 
        text: "🎉 **Congratulations! You are eligible.**\n\n☎️ **DM US For Full Access** 🌐\n✉️ @Binance_Share_Trading ❤️", 
        sender: 'agent', 
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
      };
      setTextMessages(prev => [...prev, contactMsg]);
      return { result: "Contact card successfully displayed on user screen." };
    }

    return { error: 'Unknown tool' };
  };

  // --- Audio Recording Logic (Voice Note) ---
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required to send voice messages.");
    }
  };

  const handleStopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = async () => {
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);
        setRecordingDuration(0);

        // Stop all tracks to release mic
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Add user audio message to UI immediately
        const newUserMsg = { 
          id: Date.now(), 
          audioUrl: audioUrl,
          sender: 'user', 
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          status: 'sent'
        };
        setTextMessages(prev => [...prev, newUserMsg]);

        // Process for Gemini
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            await processMessageToGemini(null, base64Audio, 'audio/webm');
          };
        } catch (e) {
          console.error("Error processing audio:", e);
        }
      };
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  // --- File Upload Logic (Screenshot) ---
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    event.target.value = '';

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const imageUrl = URL.createObjectURL(file);
      const mimeType = file.type;

      // Add image to chat UI
      const newUserMsg = { 
        id: Date.now(), 
        imageUrl: imageUrl,
        sender: 'user', 
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        status: 'sent'
      };
      setTextMessages(prev => [...prev, newUserMsg]);

      // Send to Gemini
      await processMessageToGemini("Here is my balance screenshot.", base64String, mimeType);
    };
    reader.readAsDataURL(file);
  };

  // --- Helper to Send to Gemini (Text or Audio or Image) ---
  const processMessageToGemini = async (text: string | null, mediaBase64: string | null = null, mimeType: string = '') => {
     const apiKey = process.env.API_KEY;
     if (!apiKey || apiKey === "undefined") {
        const errorMsg = "API Key is missing or invalid. Please check your settings.";
        console.error(errorMsg);
        setTextMessages(prev => [...prev, { id: Date.now(), text: errorMsg, sender: 'agent', time: new Date().toLocaleTimeString() }]);
        return;
     }

     try {
      // Initialize Chat Client if needed
      if (!chatSessionRef.current) {
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: {
            systemInstruction: WHALES_PUMP_INSTRUCTION,
            tools: [{ functionDeclarations: [ELIGIBILITY_TOOL, PROFIT_CALCULATOR_TOOL, PROVIDE_CONTACT_TOOL] }],
          }
        });
      }

      let messagePayload: any;

      if (mediaBase64) {
         // Handle Media (Image or Audio)
         const parts: any[] = [
            { inlineData: { mimeType: mimeType, data: mediaBase64 } }
         ];
         if (text) parts.push({ text: text });
         
         messagePayload = { message: { parts } };
      } else if (text) {
         // Handle Text Only
         messagePayload = { message: text };
      } else {
        return;
      }

      let response = await chatSessionRef.current.sendMessage(messagePayload);

      // Handle Function Calling Loop
      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses = [];
        for (const call of response.functionCalls) {
          const result = await executeTool(call.name, call.args);
          functionResponses.push({
            functionResponse: {
              name: call.name,
              id: call.id,
              response: { result }
            }
          });
        }
        response = await chatSessionRef.current.sendMessage({ message: functionResponses });
      }

      // Final Text Response
      if (response.text) {
        const newAgentMsg = { 
          id: Date.now() + 1, 
          text: response.text, 
          sender: 'agent', 
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
        };
        setTextMessages(prev => [...prev, newAgentMsg]);
      }

    } catch (e: any) {
      console.error("Gemini Chat Error:", e);
      let errorMessage = "Sorry, something went wrong.";
      
      if (e.message?.includes('Network') || e.message?.includes('fetch')) {
         errorMessage = "Network Error: Please check your internet connection. Retrying might help.";
         chatSessionRef.current = null;
      }
      
      setTextMessages(prev => [...prev, { 
        id: Date.now(), 
        text: errorMessage, 
        sender: 'agent', 
        time: new Date().toLocaleTimeString() 
      }]);
    }
  };

  const stopAudio = useCallback(() => {
    // Stop microphone (Live Call)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }

    // Stop playback
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    activeSourcesRef.current.clear();
    
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Close Gemini session
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    sessionPromiseRef.current = null;
    nextStartTimeRef.current = 0;
    setIsAgentSpeaking(false);
    
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    setCallDuration(0);

  }, []);

  const handleEndCall = useCallback(() => {
    stopAudio();
    setConnectionState(ConnectionState.DISCONNECTED);
    setView('chat');
  }, [stopAudio]);

  const handlePhoneClick = () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      setView('call');
    } else {
      startSession();
    }
  };

  const handleSendTextMessage = async () => {
    if (!inputText.trim()) return;
    const userText = inputText.trim();
    setInputText("");

    const newUserMsg = { 
      id: Date.now(), 
      text: userText, 
      sender: 'user', 
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      status: 'sent'
    };
    setTextMessages(prev => [...prev, newUserMsg]);

    await processMessageToGemini(userText);
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  // --- Voice Session Logic (Live Call) ---
  const startSession = async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "undefined") {
      const errorMsg = "API Key is missing. Please check your configuration.";
      console.error(errorMsg);
      setTextMessages(prev => [...prev, { id: Date.now(), text: errorMsg, sender: 'agent', time: new Date().toLocaleTimeString() }]);
      return;
    }

    // Switch to call view
    setView('call');
    setError(null);
    setConnectionState(ConnectionState.CONNECTING);

    try {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey });

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
          systemInstruction: WHALES_PUMP_INSTRUCTION,
          tools: [{ functionDeclarations: [ELIGIBILITY_TOOL, PROFIT_CALCULATOR_TOOL, PROVIDE_CONTACT_TOOL] }],
        },
      };

      const sessionPromise = ai.live.connect({
        model: config.model,
        config: config.config,
        callbacks: {
          onopen: async () => {
            console.log('Gemini Live Session Opened');
            setConnectionState(ConnectionState.CONNECTED);
            
            // Start duration timer
            durationIntervalRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);

            // Initial trigger
            if (sessionPromiseRef.current) {
              const session = await sessionPromiseRef.current;
              try {
                session.send({
                  clientContent: {
                    turns: [{ role: 'user', parts: [{ text: "Hello" }] }],
                    turnComplete: true
                  }
                });
              } catch (e) { console.warn(e); }
            }

            // Mic Stream
            if (!inputAudioContextRef.current || !streamRef.current) return;
            const ctx = inputAudioContextRef.current;
            const source = ctx.createMediaStreamSource(streamRef.current);
            inputSourceRef.current = source;
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (isMicMuted) return; 
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmInt16 = float32ToInt16Pcm(inputData);
              const pcmUint8 = new Uint8Array(pcmInt16.buffer);
              const base64 = arrayBufferToBase64(pcmUint8);

              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => {
                  session.sendRealtimeInput({
                    media: {
                      mimeType: 'audio/pcm;rate=16000',
                      data: base64
                    }
                  });
                });
              }
            };
            source.connect(processor);
            processor.connect(ctx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             if (msg.toolCall) {
               for (const fc of msg.toolCall.functionCalls) {
                 const result = await executeTool(fc.name, fc.args);
                 if (sessionPromiseRef.current) {
                    sessionPromiseRef.current.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          id: fc.id,
                          name: fc.name,
                          response: { result }
                        }]
                      });
                    });
                 }
               }
             }

             const interrupted = msg.serverContent?.interrupted;
             if (interrupted) {
                activeSourcesRef.current.forEach(source => {
                  try { source.stop(); } catch(e) {}
                });
                activeSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsAgentSpeaking(false);
             }

             const modelTurn = msg.serverContent?.modelTurn;
             if (modelTurn && modelTurn.parts) {
               for (const part of modelTurn.parts) {
                 if (part.inlineData && part.inlineData.data) {
                   const base64Audio = part.inlineData.data;
                   const outputCtx = outputAudioContextRef.current;
                   if (outputCtx) {
                     if (outputCtx.state === 'suspended') await outputCtx.resume();

                     const uint8Data = base64ToUint8Array(base64Audio);
                     const audioBuffer = pcmToAudioBuffer(uint8Data, outputCtx, 24000);
                     const now = outputCtx.currentTime;
                     
                     nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
                     
                     const source = outputCtx.createBufferSource();
                     source.buffer = audioBuffer;
                     source.connect(outputCtx.destination);
                     source.start(nextStartTimeRef.current);
                     
                     nextStartTimeRef.current += audioBuffer.duration;
                     activeSourcesRef.current.add(source);
                     
                     setIsAgentSpeaking(true);
                     source.onended = () => {
                        activeSourcesRef.current.delete(source);
                        if (activeSourcesRef.current.size === 0) {
                          setIsAgentSpeaking(false);
                        }
                     };
                   }
                 }
               }
             }
          },
          onclose: () => handleEndCall(),
          onerror: (err) => {
            console.error(err);
            // Reset session on error
            chatSessionRef.current = null;
            setError("Connection Failed. Please try again.");
            handleEndCall();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;
      sessionPromise.then(sess => sessionRef.current = sess);

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      handleEndCall();
    }
  };

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const toggleMute = () => {
    setIsMicMuted(prev => !prev);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => track.enabled = isMicMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // -------------------------------------------
  // RENDER: Chat List / Chat Interface
  // -------------------------------------------
  if (view === 'chat') {
    return (
      <div className="flex flex-col h-full w-full bg-[#0b141a] relative">
        
        {/* WhatsApp-style Active Call Return Banner */}
        {(connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) && (
           <div 
             onClick={() => setView('call')}
             className="bg-[#00a884] h-10 flex items-center justify-center gap-2 cursor-pointer z-50 shadow-md w-full"
           >
              <span className="text-white text-sm font-medium">Tap to return to call</span>
              <span className="text-white text-sm font-medium">•</span>
              <span className="text-white text-sm font-medium">{formatTime(callDuration)}</span>
           </div>
        )}

        {/* Header */}
        <div className="bg-[#202c33] py-3 px-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="text-[#aebac1] cursor-pointer">
              <i className="fa-solid fa-arrow-left text-xl"></i>
            </div>
            <div className="relative">
              <WhalesPumpLogo className="w-10 h-10 rounded-full" iconSize="text-xl" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-[#e9edef] font-medium text-base leading-tight">Whales Pump Support</h3>
              <span className="text-[#8696a0] text-xs">Online</span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-[#00a884]">
            <i className="fa-solid fa-video text-lg cursor-pointer"></i>
            {/* Logic updated to resume call if active, else start new */}
            <i className="fa-solid fa-phone text-lg cursor-pointer" onClick={handlePhoneClick}></i>
            <i className="fa-solid fa-ellipsis-vertical text-[#8696a0] text-lg cursor-pointer"></i>
          </div>
        </div>

        {/* Chat Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#0b141a] relative bg-opacity-95">
          {/* Doodle Background Pattern */}
          <div className="absolute inset-0 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] opacity-[0.06] pointer-events-none"></div>
          
          <div className="space-y-1.5 z-10 relative pb-2">
            {/* Date Divider */}
            <div className="flex justify-center mb-4 mt-2">
               <span className="bg-[#182229] text-[#8696a0] text-xs py-1.5 px-3 rounded-lg shadow-sm">Today</span>
            </div>

            {/* Encrypted Notice */}
            <div className="flex justify-center mb-6">
              <div className="bg-[#182229] text-[#ffcc00] text-[10px] py-1.5 px-3 rounded-lg text-center flex items-center gap-1.5 max-w-xs leading-3">
                 <i className="fa-solid fa-lock text-[10px]"></i> Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
              </div>
            </div>

            {/* Messages Map */}
            {textMessages.map((msg, idx) => (
               <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
                  <div className={`${msg.sender === 'user' ? 'bg-[#005c4b] rounded-tr-none' : 'bg-[#202c33] rounded-tl-none'} p-2 rounded-lg max-w-[85%] shadow-sm relative min-w-[80px]`}>
                    
                    {/* Corner SVGs for proper tails */}
                    {msg.sender === 'user' ? (
                      <svg viewBox="0 0 8 13" height="13" width="8" className="absolute top-0 -right-[8px] text-[#005c4b] fill-current block">
                        <path d="M0,0 L8,0 L0,13 Z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 8 13" height="13" width="8" className="absolute top-0 -left-[8px] text-[#202c33] fill-current block">
                        <path d="M8,0 L0,0 L8,13 Z" />
                      </svg>
                    )}
                    
                    {/* Content: Text, Audio or Image */}
                    {msg.imageUrl ? (
                       <div className="min-w-[200px] p-1">
                          <img src={msg.imageUrl} alt="Attachment" className="rounded-lg max-h-[300px] w-full object-cover" />
                       </div>
                    ) : msg.audioUrl ? (
                      <div className="flex items-center gap-2 min-w-[200px] py-1">
                         <div className="relative w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center">
                            <i className="fa-solid fa-microphone text-white text-sm"></i>
                         </div>
                         <div className="flex-1">
                            <audio 
                              controls 
                              src={msg.audioUrl} 
                              className="w-full h-8 max-w-[200px] audio-player-custom" 
                              style={{ filter: msg.sender === 'user' ? 'invert(1) opacity(0.8)' : 'invert(1) opacity(0.8)' }}
                            />
                         </div>
                      </div>
                    ) : (
                      <p className="text-[#e9edef] text-sm leading-relaxed whitespace-pre-wrap pb-2">
                        {msg.text}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-1 absolute bottom-1 right-1.5">
                       <span className={`${msg.sender === 'user' ? 'text-[#c1e6e1]' : 'text-[#8696a0]'} text-[10px]`}>{msg.time}</span>
                       {msg.sender === 'user' && (
                         <span className="text-[#53bdeb] text-[10px]">
                           <i className="fa-solid fa-check-double"></i>
                         </span>
                       )}
                    </div>
                  </div>
               </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Emoji Picker Panel */}
        {showEmojiPicker && !isRecording && (
          <div className="bg-[#202c33] h-[250px] overflow-y-auto p-2 grid grid-cols-8 gap-2 border-b border-[#2a3942] z-20">
            {EMOJI_LIST.map((emoji) => (
              <button 
                key={emoji} 
                onClick={() => handleEmojiClick(emoji)}
                className="text-2xl hover:bg-[#2a3942] p-2 rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Hidden File Input */}
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Input Bar / Recording Bar */}
        {isRecording ? (
           <div className="bg-[#202c33] px-4 py-2 flex items-center gap-4 z-20 h-[62px]">
              <div 
                className="text-[#f15c6d] cursor-pointer animate-pulse" 
                onClick={handleCancelRecording}
              >
                 <i className="fa-solid fa-trash-can text-xl"></i>
              </div>
              <div className="flex-1 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-[#f15c6d] animate-pulse"></div>
                 <span className="text-[#e9edef] font-mono text-base">
                   {formatTime(recordingDuration)}
                 </span>
                 <span className="text-[#8696a0] text-sm ml-2">Recording...</span>
              </div>
              <div 
                 className="p-3 bg-[#00a884] rounded-full text-white shadow-md cursor-pointer active:scale-95 transition-transform flex items-center justify-center"
                 onClick={handleStopAndSendRecording}
              >
                 <i className="fa-solid fa-paper-plane text-lg ml-0.5"></i>
              </div>
           </div>
        ) : (
          <div className="bg-[#202c33] px-2 py-2 flex items-center gap-2 z-20 min-h-[60px]">
            {/* Emoji Toggle */}
            <div 
               className="p-2 text-[#8696a0] cursor-pointer" 
               onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
               {showEmojiPicker ? (
                  <i className="fa-solid fa-keyboard text-2xl"></i>
               ) : (
                  <i className="fa-regular fa-face-smile text-2xl"></i>
               )}
            </div>
            
            {/* Input Pill (Matches WhatsApp Latest) */}
            <div className="flex-1 bg-[#2a3942] rounded-[24px] flex items-center px-4 py-2 gap-3">
              <input 
                 type="text"
                 value={inputText}
                 onClick={() => setShowEmojiPicker(false)} // Close emoji picker when typing
                 onChange={(e) => setInputText(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSendTextMessage()}
                 placeholder="Message"
                 className="w-full bg-transparent text-[#d1d7db] text-sm focus:outline-none placeholder-[#8696a0]"
              />
              
              {/* Paperclip Inside */}
              <div 
                 className="text-[#8696a0] cursor-pointer"
                 onClick={() => fileInputRef.current?.click()}
              >
                 <i className="fa-solid fa-paperclip text-xl -rotate-45"></i>
              </div>

              {/* Camera Inside (Only if empty) */}
              {!inputText.trim() && (
                <div 
                   className="text-[#8696a0] cursor-pointer" 
                   onClick={() => fileInputRef.current?.click()}
                >
                   <i className="fa-solid fa-camera text-xl"></i>
                </div>
              )}
            </div>
            
            {/* Mic / Send Button (Circle Outside) */}
            <div 
                 className="w-12 h-12 bg-[#00a884] rounded-full text-white shadow-md cursor-pointer active:scale-95 transition-transform flex items-center justify-center shrink-0 ml-1"
                 onClick={inputText.trim() ? handleSendTextMessage : handleStartRecording}
            >
                 {inputText.trim() ? (
                    <i className="fa-solid fa-paper-plane text-lg ml-0.5"></i>
                 ) : (
                    <i className="fa-solid fa-microphone text-lg"></i>
                 )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------
  // RENDER: Call Interface (WhatsApp Style)
  // -------------------------------------------
  return (
    <div className="flex flex-col h-full w-full bg-[#0b141a] relative text-white">
       
       {/* Top Bar */}
       <div className="pt-6 pb-2 px-4 flex flex-col items-center relative z-20">
          <div className="flex items-center gap-1.5 text-[#8696a0] text-[10px] mb-4">
             <i className="fa-solid fa-lock text-[10px]"></i> End-to-end encrypted
          </div>
          <h2 className="text-xl font-semibold tracking-wide">Whales Pump Support</h2>
          <p className="text-[#8696a0] text-sm mt-1">
            {connectionState === ConnectionState.CONNECTING ? "Connecting..." : 
             connectionState === ConnectionState.CONNECTED ? formatTime(callDuration) : "Call Ended"}
          </p>
       </div>

       {/* Main Content - Avatar & Visualizer */}
       <div className="flex-1 flex flex-col items-center justify-center z-10 relative">
          {/* Profile Picture Area */}
          <div className="relative">
             <div className={`w-32 h-32 rounded-full overflow-hidden border-4 shadow-2xl transition-all duration-500 ${isAgentSpeaking ? 'border-[#00a884] scale-110' : 'border-[#202c33]'}`}>
               <WhalesPumpLogo className="w-full h-full" iconSize="text-6xl" />
             </div>
          </div>
          
          {/* Visualizer Container */}
          <div className="mt-12 h-16 w-full flex items-center justify-center">
             {connectionState === ConnectionState.CONNECTED && (
                <Visualizer isActive={isAgentSpeaking} />
             )}
          </div>

          {/* Error Message */}
          {error && (
             <div className="mt-4 bg-red-500/20 text-red-200 px-4 py-2 rounded-lg text-sm">
               {error}
             </div>
          )}
       </div>

       {/* Bottom Controls Sheet */}
       <div className="bg-[#101d25] rounded-t-[30px] pt-4 pb-10 px-8 w-full z-20 absolute bottom-0 border-t border-white/5 shadow-2xl">
         {/* Handle */}
         <div className="flex justify-center mb-8">
            <div className="w-10 h-1 bg-[#8696a0] rounded-full opacity-40"></div>
         </div>
         
         {/* Controls Grid */}
         <div className="flex items-center justify-between max-w-[340px] mx-auto">
            {/* 1. Message Button */}
            <button 
              onClick={() => setView('chat')}
              className="w-12 h-12 rounded-full bg-[#1f2c34] flex items-center justify-center text-white shadow-lg active:scale-95 transition-all duration-200"
            >
               <i className="fa-solid fa-comment-alt text-lg"></i>
            </button>

            {/* 2. Video Toggle */}
            <button className="w-12 h-12 rounded-full bg-[#1f2c34] flex items-center justify-center text-white shadow-lg active:scale-95 transition-all duration-200 opacity-60">
               <i className="fa-solid fa-video text-lg"></i>
            </button>

            {/* 3. Mute Toggle */}
            <button 
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all duration-200 ${
                isMicMuted ? 'bg-white text-[#0b141a]' : 'bg-[#1f2c34] text-white'
              }`}
            >
              {isMicMuted ? (
                <i className="fa-solid fa-microphone-slash text-lg"></i>
              ) : (
                <i className="fa-solid fa-microphone text-lg"></i>
              )}
            </button>

            {/* 4. End Call - Red with Phone Down icon */}
            <button 
              onClick={handleEndCall}
              className="w-12 h-12 rounded-full bg-[#ea0038] flex items-center justify-center text-white shadow-lg active:scale-95 transition-all duration-200 hover:bg-[#ff2b2b]"
            >
               {/* Rotate 135deg to make the phone icon point down (Hang up style) */}
               <i className="fa-solid fa-phone text-lg rotate-[135deg]"></i>
            </button>
         </div>
       </div>

       {/* Background Elements */}
       <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00a884] via-transparent to-transparent"></div>
    </div>
  );
};

export default LiveVoiceChat;