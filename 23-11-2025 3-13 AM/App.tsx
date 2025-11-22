import React from 'react';
import LiveVoiceChat from './components/LiveVoiceChat';

function App() {
  return (
    <div className="h-screen w-full bg-[#111b21] flex justify-center overflow-hidden">
      {/* Mobile Container Restraint */}
      <div className="w-full max-w-md h-full bg-[#0b141a] relative shadow-2xl flex flex-col">
        <LiveVoiceChat />
      </div>
    </div>
  );
}

export default App;