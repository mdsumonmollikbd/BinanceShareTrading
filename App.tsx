import React from 'react';
import LiveVoiceChat from './components/LiveVoiceChat';
import { TrendingUp } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Elements for Aesthetics */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2" />

      <main className="w-full max-w-4xl z-10">
        <div className="text-center mb-12 px-4">
          <div className="inline-flex items-center justify-center gap-3 mb-4 bg-slate-800/50 px-6 py-3 rounded-full border border-slate-700">
             <TrendingUp className="text-cyan-400 w-8 h-8" />
             <h1 className="text-2xl md:text-3xl font-bold text-white">
              Whales Pump
            </h1>
          </div>
          <p className="text-slate-400 max-w-xl mx-auto">
            Welcome to our <strong>Futures Trading Signals</strong> AI Support. <br/>
            Talk to our AI agent to choose the best package for your capital.
          </p>
        </div>

        <LiveVoiceChat />

        <div className="mt-12 text-center text-slate-600 text-sm">
          <p>We offer Profit-Sharing Models and VIP Signals.</p>
          <p className="mt-2">Microphone permission is required to speak with the agent.</p>
        </div>
      </main>
    </div>
  );
}

export default App;