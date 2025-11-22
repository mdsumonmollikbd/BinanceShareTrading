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
import { 
  Phone, PhoneOff, ArrowLeft, Video, 
  MoreVertical, Paperclip, Camera, Smile, Lock, Send, Trash2, Keyboard
} from 'lucide-react';

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

TOOLS USAGE:
- If the user asks for a recommendation, politely ask about their available capital.
- Use "check_eligibility" if they provide their capital.
- Use "calculate_profit_share" to show transparent calculations.

RESTRICTIONS:
- Do NOT guarantee profits (say "potential profit" or "InshaAllah").
- Do NOT give financial advice outside our signals.
`;

// Common Emojis List
const EMOJI_LIST = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","🥲","☺️","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾",
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

  // --- Business Logic Executors ---
  const executeTool = async (name: string, args: any) => {
    console.log(`Executing business logic for: ${name}`, args);
    await new Promise(resolve => setTimeout(resolve, 200));

    if (name === 'check_eligibility') {
      const { capital } = args;
      if (capital >= 5000) {
        return { 
          result: "Eligible for BOTH options.",
          recommendation: "Since you have over $5,000, you can choose Option 1 (Profit Share) which is like a partnership, or Option 2 ($200/month) if you prefer a fixed fee." 
        };
      } else {
        return { 
          result: "Eligible for Option 2 ONLY.",
          recommendation: `With $${capital}, you do not meet the $5,000 requirement for Option 1. You must choose Option 2 (VIP Signal) for $200/month.` 
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

  // --- Helper to Send to Gemini (Text or Audio) ---
  const processMessageToGemini = async (text: string | null, audioBase64: string | null = null, mimeType: string = '') => {
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
            tools: [{ functionDeclarations: [ELIGIBILITY_TOOL, PROFIT_CALCULATOR_TOOL] }],
          }
        });
      }

      let messagePayload: any;
      if (text) {
        messagePayload = { message: text };
      } else if (audioBase64) {
        // Send audio part
        messagePayload = { 
          message: [
            { 
              inlineData: { 
                mimeType: mimeType, 
                data: audioBase64 
              } 
            }
          ] 
        };
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
      
      // Handle Network/API Errors
      if (e.message?.includes('Network') || e.message?.includes('fetch')) {
         errorMessage = "Network Error: Please check your internet connection. Retrying might help.";
         // Reset session on network error to force reconnection logic next time
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
          tools: [{ functionDeclarations: [ELIGIBILITY_TOOL, PROFIT_CALCULATOR_TOOL] }],
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
      <div className="flex flex-col h-full w-full bg-[#0b141a]">
        {/* Header */}
        <div className="bg-[#202c33] py-3 px-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="text-[#aebac1] cursor-pointer"><ArrowLeft size={24} /></div>
            <div className="relative">
              <WhalesPumpLogo className="w-10 h-10 rounded-full" iconSize="text-xl" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-[#e9edef] font-medium text-base leading-tight">Whales Pump Support</h3>
              <span className="text-[#8696a0] text-xs">Online</span>
            </div>
          </div>
          <div className="flex items-center gap-5 text-[#00a884]">
            <Video size={22} className="cursor-pointer" />
            <Phone size={22} className="cursor-pointer fill-current" onClick={startSession} />
            <MoreVertical size={22} className="text-[#8696a0] cursor-pointer" />
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
              <div className="bg-[#182229] text-[#ffcc00] text-[10px] py-1.5 px-3 rounded-lg text-center flex items-center gap-1 max-w-xs leading-3">
                 <Lock size={10} /> Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
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
                    
                    {/* Content: Text or Audio */}
                    {msg.audioUrl ? (
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
                       {msg.sender === 'user' && <span className="text-[#53bdeb] text-[10px]">✓✓</span>}
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

        {/* Input Bar / Recording Bar */}
        {isRecording ? (
           <div className="bg-[#202c33] px-4 py-2 flex items-center gap-4 z-20 h-[62px]">
              <div 
                className="text-[#f15c6d] cursor-pointer animate-pulse" 
                onClick={handleCancelRecording}
              >
                 <Trash2 size={24} />
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
                 <Send size={20} fill="white" className="ml-0.5" />
              </div>
           </div>
        ) : (
          <div className="bg-[#202c33] px-2 py-2 flex items-center gap-2 z-20">
            <div 
              className="p-2 text-[#8696a0] cursor-pointer" 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              {showEmojiPicker ? <Keyboard size={24} /> : <Smile size={24} />}
            </div>
            <div className="p-2 text-[#8696a0] cursor-pointer"><Paperclip size={24} /></div>
            
            <div className="flex-1 bg-[#2a3942] rounded-lg flex items-center px-3 py-1">
              <input 
                 type="text"
                 value={inputText}
                 onClick={() => setShowEmojiPicker(false)} // Close emoji picker when typing
                 onChange={(e) => setInputText(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSendTextMessage()}
                 placeholder="Message"
                 className="w-full bg-transparent text-[#d1d7db] text-sm py-2 focus:outline-none placeholder-[#8696a0]"
              />
            </div>
            
            {inputText.trim() ? (
              <div 
                className="p-3 bg-[#00a884] rounded-full text-white shadow-md cursor-pointer active:scale-95 transition-transform flex items-center justify-center"
                onClick={handleSendTextMessage}
              >
                <Send size={20} fill="white" className="ml-0.5" />
              </div>
            ) : (
               <>
                <div className="p-2 text-[#8696a0] cursor-pointer"><Camera size={24} /></div>
                <div 
                  className="p-3 bg-[#00a884] rounded-full text-white shadow-md cursor-pointer active:scale-95 transition-transform flex items-center justify-center"
                  onClick={handleStartRecording}
                >
                  <i className="fa-solid fa-microphone text-lg"></i>
                </div>
               </>
            )}
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
          <div className="flex items-center gap-1 text-[#8696a0] text-[10px] mb-4">
             <Lock size={10} /> End-to-end encrypted
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
       <div className="bg-[#101d25] rounded-t-3xl pt-6 pb-8 px-8 w-full z-20">
         <div className="flex justify-center mb-2">
            <div className="w-10 h-1 bg-[#37404a] rounded-full opacity-50 mb-6"></div>
         </div>
         
         <div className="flex items-center justify-between max-w-xs mx-auto">
            {/* Speaker (Visual only) */}
            <button className="p-3 rounded-full hover:bg-[#ffffff10] text-white transition-colors">
               <div className="w-6 h-6 flex items-center justify-center border border-white rounded-md">
                  <span className="text-[10px] font-bold">···</span>
               </div>
            </button>

            {/* Video Toggle (Visual only) */}
            <button className="p-3 rounded-full hover:bg-[#ffffff10] text-[#8696a0] transition-colors">
               <Video size={28} className="fill-[#8696a0]" />
            </button>

            {/* Mute Toggle */}
            <button 
              onClick={toggleMute}
              className={`p-3 rounded-full transition-colors ${isMicMuted ? 'bg-white text-black' : 'hover:bg-[#ffffff10] text-white'}`}
            >
              {isMicMuted ? <i className="fa-solid fa-microphone-slash text-xl"></i> : <i className="fa-solid fa-microphone text-xl"></i>}
            </button>

            {/* End Call */}
            <button 
              onClick={handleEndCall}
              className="p-4 bg-[#f15c6d] rounded-full text-white shadow-lg hover:opacity-90 transition-transform active:scale-95"
            >
               <PhoneOff size={28} className="fill-white" />
            </button>
         </div>
       </div>

       {/* Background Elements */}
       <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00a884] via-transparent to-transparent"></div>
    </div>
  );
};

export default LiveVoiceChat;