import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
        // Draw a flat line when inactive
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = '#475569'; // Slate 600
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      // Draw active waveform
      ctx.beginPath();
      const centerY = height / 2;
      
      // Create a dynamic wave
      for (let x = 0; x < width; x++) {
        // Combine a few sine waves for an organic "voice" look
        const y = 
          Math.sin(x * 0.02 + time) * 20 +
          Math.sin(x * 0.05 + time * 2) * 10 +
          Math.sin(x * 0.1 + time * 0.5) * 5;
        
        // Taper the ends
        const scale = Math.min(x, width - x) / (width / 2);
        
        ctx.lineTo(x, centerY + y * scale);
      }

      // Gradient stroke
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#3b82f6'); // Blue 500
      gradient.addColorStop(0.5, '#a855f7'); // Purple 500
      gradient.addColorStop(1, '#ec4899'); // Pink 500
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.stroke();

      time += 0.15;
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  return (
    <div className="w-full h-32 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden backdrop-blur-sm">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={128} 
        className="w-full h-full"
      />
    </div>
  );
};

export default Visualizer;
