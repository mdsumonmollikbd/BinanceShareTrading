import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from '../types';
import Visualizer from './Visualizer';
import { 
  base64ToUint8Array, 
  pcmToAudioBuffer, 
  float32ToInt16Pcm, 
  arrayBufferToBase64 
} from '../utils/audioUtils';
import { Mic, MicOff, Phone, PhoneOff, AlertCircle, Loader2, TrendingUp, DollarSign, Calculator, Volume2 } from 'lucide-react';

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

// Whales Pump Specific Instruction with Islamic Etiquette
const WHALES_PUMP_INSTRUCTION = `
You are a respectful and professional sales representative for "Whales Pump Share Trading".
CONTEXT: You follow Islamic business etiquette (Adab) strictly.

CRITICAL BEHAVIOR & GREETING:
1. **Greeting:** You MUST start the conversation (or reply to the first hello) with the Islamic greeting: "Assalamu Alaikum wa Rahmatullah" (Peace be upon you and God's mercy).
2. **Tone:** Be polite, humble, honest, and transparent.
3. **Language:** Speak fluently in Bengali and English. You may use phrases like "InshaAllah" (if God wills) when talking about future profits, and "Alhamdulillah" (Praise be to God) when talking about success.

Your Goal: Help customers choose between our two specific trading signal packages based on their requirements and capital.

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
- Do NOT give advice outside these two options.
`;

const LiveVoiceChat: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  // Audio Context Refs
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

  // --- Business Logic Executors ---
  const executeTool = async (name: string, args: any) => {
    console.log(`Executing business logic for: ${name}`, args);
    
    // Simulate slight processing delay
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

  const stopAudio = useCallback(() => {
    // Stop microphone
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
  }, []);

  const handleDisconnect = useCallback(() => {
    stopAudio();
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [stopAudio]);

  const startSession = async () => {
    setError(null);
    setConnectionState(ConnectionState.CONNECTING);

    try {
      // 1. Initialize Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // CRITICAL: Ensure Contexts are resumed (fixes "no audio" issue in some browsers)
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();

      // 2. Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 3. Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

      // 4. Configure Session
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }, // Professional female voice
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
            
            // TRIGGER: Send a silent "Hello" to force the model to speak the greeting first
            if (sessionPromiseRef.current) {
              const session = await sessionPromiseRef.current;
              try {
                session.send({
                  clientContent: {
                    turns: [{ role: 'user', parts: [{ text: "Hello, please introduce yourself." }] }],
                    turnComplete: true
                  }
                });
              } catch (e) {
                console.warn("Could not send initial trigger, waiting for user input.", e);
              }
            }

            // Setup Mic Stream
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
             // Handle Tool Calls (Business Logic)
             if (msg.toolCall) {
               console.log("Tool call received:", msg.toolCall);
               for (const fc of msg.toolCall.functionCalls) {
                 const result = await executeTool(fc.name, fc.args);
                 
                 // Send result back to Gemini
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

             // Handle Interruption
             const interrupted = msg.serverContent?.interrupted;
             if (interrupted) {
                activeSourcesRef.current.forEach(source => {
                  try { source.stop(); } catch(e) {}
                });
                activeSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsAgentSpeaking(false);
             }

             // Handle Audio Output
             const modelTurn = msg.serverContent?.modelTurn;
             if (modelTurn && modelTurn.parts) {
               for (const part of modelTurn.parts) {
                 if (part.inlineData && part.inlineData.data) {
                   const base64Audio = part.inlineData.data;
                   const outputCtx = outputAudioContextRef.current;
                   if (outputCtx) {
                     // Ensure context is running
                     if (outputCtx.state === 'suspended') {
                       await outputCtx.resume();
                     }

                     const uint8Data = base64ToUint8Array(base64Audio);
                     const audioBuffer = pcmToAudioBuffer(uint8Data, outputCtx, 24000);
                     const now = outputCtx.currentTime;
                     
                     // Buffer scheduling to prevent overlap or gaps
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
          onclose: () => handleDisconnect(),
          onerror: (err) => {
            console.error(err);
            setError("Connection lost.");
            handleDisconnect();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;
      sessionPromise.then(sess => sessionRef.current = sess);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect.");
      handleDisconnect();
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

  return (
    <div className="w-full max-w-lg mx-auto p-6">
      <div className="bg-slate-800/50 rounded-3xl border border-slate-700 shadow-2xl p-8 flex flex-col items-center gap-6 relative overflow-hidden">
        
        <div className={`absolute top-0 left-0 w-full h-full transition-opacity duration-1000 pointer-events-none ${connectionState === ConnectionState.CONNECTED ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        </div>

        {/* Header */}
        <div className="text-center z-10 w-full">
          <div className="flex items-center justify-center gap-2 mb-2">
             <TrendingUp className="text-cyan-400 w-6 h-6" />
             <h2 className="text-xl font-bold text-white tracking-wide uppercase">Whales Pump</h2>
          </div>
          <p className="text-slate-400 text-sm font-medium">Islamic & Halal Trading Support</p>
          
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 text-center">
                <div className="flex justify-center mb-1 text-green-400"><TrendingUp size={18} /></div>
                <p className="text-xs text-slate-300 font-semibold">Option 1: Share</p>
                <p className="text-[10px] text-slate-500">Min $5k • Musharakah</p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 text-center">
                <div className="flex justify-center mb-1 text-yellow-400"><DollarSign size={18} /></div>
                <p className="text-xs text-slate-300 font-semibold">Option 2: VIP</p>
                <p className="text-[10px] text-slate-500">$200/mo • Ujrah</p>
            </div>
          </div>

          <div className="mt-4 min-h-[20px]">
            {connectionState === ConnectionState.CONNECTED && (
               <p className="text-xs text-emerald-400 bg-emerald-900/20 py-1 px-3 rounded-full inline-flex items-center gap-1 animate-pulse">
                 <Volume2 size={12} />
                 {isAgentSpeaking ? "Agent Speaking..." : "Listening to you..."}
               </p>
            )}
            {connectionState === ConnectionState.DISCONNECTED && (
              <p className="text-xs text-cyan-300 bg-cyan-900/20 py-1 px-3 rounded-full inline-flex items-center gap-1">
                <Calculator size={12} />
                Try: "আসসালামু আলাইকুম, আমি কিভাবে শুরু করতে পারি?"
              </p>
            )}
          </div>
        </div>

        <Visualizer isActive={connectionState === ConnectionState.CONNECTED && isAgentSpeaking} />

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg text-sm border border-red-400/20 z-10">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-6 z-10">
          {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR || connectionState === ConnectionState.CONNECTING ? (
            <button
              onClick={startSession}
              disabled={connectionState === ConnectionState.CONNECTING}
              className="group relative flex items-center justify-center w-20 h-20 bg-cyan-600 hover:bg-cyan-500 rounded-full transition-all shadow-lg shadow-cyan-600/30 hover:scale-105 disabled:opacity-70 disabled:scale-100"
            >
              {connectionState === ConnectionState.CONNECTING ? (
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              ) : (
                <Phone className="w-8 h-8 text-white fill-current" />
              )}
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-colors border ${
                  isMicMuted 
                    ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                    : 'bg-slate-700/50 border-slate-600 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center justify-center w-20 h-20 bg-red-500 hover:bg-red-400 rounded-full transition-all shadow-lg shadow-red-500/30 hover:scale-105"
              >
                <PhoneOff className="w-8 h-8 text-white fill-current" />
              </button>
            </>
          )}
        </div>

        <div className="z-10 h-6">
          <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
            {connectionState === ConnectionState.CONNECTING ? "Connecting..." : 
             connectionState === ConnectionState.CONNECTED ? "Live Agent Active" : "Call Now"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LiveVoiceChat;