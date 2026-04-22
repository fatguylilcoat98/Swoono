import { useEffect, useRef } from "react";

interface ILoveYouEffectProps {
  onComplete?: () => void;
}

export default function ILoveYouEffect({ onComplete }: ILoveYouEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to fullscreen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Web Audio for piano chord
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      // Silent if audio fails
    }

    const playPianoChord = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;

        // C major chord (C, E, G) - soft and sustained
        const frequencies = [261.63, 329.63, 392.00]; // C4, E4, G4

        frequencies.forEach((freq) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 5);

          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 5);
        });
      } catch {
        // Silent fail
      }
    };

    // Text animation state
    let textLetters = "I Love You".split('');
    let lettersRevealed = 0;

    // Hearts pulsing around text
    const hearts: Array<{
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      pulseOffset: number;
      color: string;
    }> = [];

    // Create hearts in a circular pattern around the text
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      const radius = 200;
      const baseX = canvas.width / 2 + Math.cos(angle) * radius;
      const baseY = canvas.height / 2 + Math.sin(angle) * radius;

      hearts.push({
        x: baseX,
        y: baseY,
        baseX: baseX,
        baseY: baseY,
        size: 20 + Math.random() * 15,
        pulseOffset: i * (Math.PI / 6),
        color: Math.random() > 0.5 ? '#ff69b4' : '#ff1744'
      });
    }

    let animationFrame: number;
    let startTime = Date.now();
    const duration = 5000; // 5 seconds

    // Play piano chord
    playPianoChord();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Soft red glow background
      const glowIntensity = 0.1 + Math.sin(elapsed * 0.002) * 0.05;
      ctx.fillStyle = `rgba(139, 0, 0, ${glowIntensity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Letter-by-letter reveal of "I Love You"
      const letterRevealDuration = 2000; // 2 seconds for all letters
      const timePerLetter = letterRevealDuration / textLetters.length;
      lettersRevealed = Math.min(textLetters.length, Math.floor(elapsed / timePerLetter) + 1);

      // Draw revealed letters
      ctx.save();
      ctx.font = 'bold 5rem serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 20;

      const revealedText = textLetters.slice(0, lettersRevealed).join('');
      ctx.fillText(revealedText, canvas.width / 2, canvas.height / 2);

      // If we're currently revealing a letter, make it slightly larger
      if (lettersRevealed < textLetters.length && elapsed < letterRevealDuration) {
        const currentLetterProgress = (elapsed % timePerLetter) / timePerLetter;
        const scale = 1 + Math.sin(currentLetterProgress * Math.PI) * 0.3;

        ctx.font = `bold ${5 * scale}rem serif`;
        const currentLetter = textLetters[lettersRevealed - 1];

        // Approximate position of current letter
        const letterWidth = ctx.measureText(revealedText.slice(0, -1)).width;
        const letterX = canvas.width / 2 - ctx.measureText(revealedText).width / 2 + letterWidth + ctx.measureText(currentLetter).width / 2;

        ctx.fillText(currentLetter, letterX, canvas.height / 2);
      }

      ctx.restore();

      // Draw pulsing hearts around the text
      hearts.forEach((heart) => {
        const pulseScale = 1 + Math.sin(elapsed * 0.003 + heart.pulseOffset) * 0.3;
        const currentSize = heart.size * pulseScale;

        // Slight floating movement
        heart.x = heart.baseX + Math.sin(elapsed * 0.001 + heart.pulseOffset) * 10;
        heart.y = heart.baseY + Math.cos(elapsed * 0.0015 + heart.pulseOffset) * 8;

        ctx.save();
        ctx.font = `${currentSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = heart.color;
        ctx.shadowColor = heart.color;
        ctx.shadowBlur = 15;
        ctx.fillText('💖', heart.x, heart.y);
        ctx.restore();
      });

      // Gentle fade out at the end
      if (elapsed > 4000) {
        const fadeProgress = (elapsed - 4000) / 1000;
        ctx.fillStyle = `rgba(0, 0, 0, ${fadeProgress * 0.8})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animate();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}