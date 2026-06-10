import { useState, useEffect, useRef } from "react";
import { ChevronRight, SkipForward, Star } from "lucide-react";
import { useLocation } from "wouter";

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const colors = ["#ff6300", "#ff9500", "#ffb347", "#fff5e6", "#ffffff", "#ffd700", "#ff4500"];
    const pieces: {
      x: number; y: number; w: number; h: number;
      color: string; rotation: number; rotationSpeed: number;
      vx: number; vy: number; gravity: number; opacity: number;
    }[] = [];

    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 100,
        y: canvas.height * 0.3,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -14 - 4,
        gravity: 0.25 + Math.random() * 0.1,
        opacity: 1,
      });
    }

    let animId: number;
    let frame = 0;
    const maxFrames = 180;

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      for (const p of pieces) {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.vx *= 0.99;
        if (frame > maxFrames - 60) {
          p.opacity = Math.max(0, p.opacity - 0.02);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (frame < maxFrames) {
        animId = requestAnimationFrame(animate);
      }
    }

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}

export default function ProWelcomePage() {
  const [, setLocation] = useLocation();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleSetupMacros = () => {
    // ?from= mirrors the Skip path so the wizard's back/exit returns the new
    // Pro user to the planner instead of the default /profile.
    setLocation("/macro-wizard?from=/plan");
  };

  const handleSkip = () => {
    setLocation("/plan");
  };

  return (
    <div className="fixed inset-0 flex justify-center" style={{ background: 'linear-gradient(170deg, #ff6300 0%, #ff9500 30%, #ffb347 60%, #fff5e6 100%)' }}>
    <div className="h-full w-full md:max-w-[430px] flex flex-col items-center relative overflow-hidden overflow-y-auto md:shadow-xl">
      {showConfetti && <Confetti />}

      <div className="flex-1 flex flex-col items-center px-6 pt-16 pb-10" style={{ position: "relative", zIndex: 1 }}>
        {/* Pro Unlocked badge */}
        <div
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full mb-6"
          style={{
            background: 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.35)',
          }}
        >
          <Star className="w-4 h-4 text-white" fill="white" />
          <span className="text-[13px] font-bold text-white tracking-wider uppercase">Pro Unlocked</span>
        </div>

        {/* Title */}
        <h1
          className="text-[32px] font-extrabold text-white mb-2 text-center"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          data-testid="text-pro-welcome-title"
        >
          You're now Pro!
        </h1>
        <p className="text-[15px] text-white/85 font-medium text-center leading-relaxed max-w-[300px] mb-9">
          Set up your macro targets to get the most out of ReciPal.
        </p>

        {/* Steps preview card */}
        <div
          className="w-full rounded-[28px] px-6 py-7 mb-4"
          style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
          }}
        >
          {/* Step 1 */}
          <div className="flex items-center gap-3.5 mb-[18px]">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[14px] font-extrabold"
              style={{ background: 'linear-gradient(135deg, #ff6300, #ff9500)' }}
            >
              1
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#1c1c1e]">Tell us about you</div>
              <div className="text-[12px] text-[#8e8e93]">Age, weight, activity level</div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3.5 mb-[18px]">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[14px] font-extrabold"
              style={{ background: 'linear-gradient(135deg, #ff6300, #ff9500)' }}
            >
              2
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#1c1c1e]">Pick your goal</div>
              <div className="text-[12px] text-[#8e8e93]">Lose, maintain, or gain</div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3.5 mb-6">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[14px] font-extrabold"
              style={{ background: 'linear-gradient(135deg, #ff6300, #ff9500)' }}
            >
              3
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#1c1c1e]">Get your targets</div>
              <div className="text-[12px] text-[#8e8e93]">Personalized macro breakdown</div>
            </div>
          </div>

          {/* CTA */}
          <button
            className="w-full py-4 border-none rounded-full bg-[#1c1c1e] text-white text-[17px] font-bold cursor-pointer flex items-center justify-center gap-2"
            onClick={handleSetupMacros}
            data-testid="button-setup-macros"
          >
            Let's go
            <ChevronRight className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Skip */}
        <button
          className="flex items-center gap-1.5 py-3.5 px-6 border-none bg-transparent cursor-pointer"
          style={{ color: 'rgba(0,0,0,0.6)' }}
          onClick={handleSkip}
          data-testid="button-skip-setup"
        >
          <SkipForward className="w-4 h-4" />
          <span className="text-[14px] font-medium">Skip for now</span>
        </button>

        <p className="text-[12px] text-center mt-3" style={{ color: 'rgba(0,0,0,0.55)' }}>
          You can always set up your macros later from your Profile.
        </p>
      </div>
    </div>
    </div>
  );
}
