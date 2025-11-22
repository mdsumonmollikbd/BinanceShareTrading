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
        // Minimal straight line when silent
        ctx.beginPath();
        ctx.moveTo(width * 0.2, height / 2);
        ctx.lineTo(width * 0.8, height / 2);
        ctx.strokeStyle = '#8696a0'; // WhatsApp Gray
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        return;
      }

      // Draw active waveform
      ctx.beginPath();
      const centerY = height / 2;
      
      // Create a dynamic wave
      for (let x = 0; x < width; x++) {
        const y = 
          Math.sin(x * 0.03 + time) * 15 +
          Math.sin(x * 0.08 + time * 2) * 8;
        
        // Taper the ends
        const scale = Math.min(x, width - x) / (width / 2);
        
        ctx.lineTo(x, centerY + y * scale);
      }

      // WhatsApp Call Green/Teal color
      ctx.strokeStyle = '#00a884'; 
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      time += 0.2;
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  return (
    <div className="w-full h-16 flex items-center justify-center opacity-80">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={64} 
        className="w-[300px] h-[64px]"
      />
    </div>
  );
};

export default Visualizer;