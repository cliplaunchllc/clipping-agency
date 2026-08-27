"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number; y: number;
  r: number;
  phase: number; speed: number;
  color: string;
}

interface Shooter {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
}

const COLORS = ["255,255,255", "180,200,255", "210,180,255", "255,230,200"];

export default function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let shooter: Shooter | null = null;
    let shooterCooldown = 300 + Math.random() * 400;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const stars: Star[] = Array.from({ length: 170 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.15 + 0.18,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.014 + 0.004,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    let t = 0;

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t++;

      // Stars
      for (const s of stars) {
        const twinkle = 0.2 + 0.8 * (Math.sin(t * s.speed + s.phase) * 0.5 + 0.5);
        const alpha = twinkle * 0.6;
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color},${alpha})`;
        ctx.fill();
        // Soft glow on bigger stars
        if (s.r > 0.85) {
          ctx.beginPath();
          ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.color},${twinkle * 0.07})`;
          ctx.fill();
        }
      }

      // Shooting star cooldown
      shooterCooldown--;
      if (!shooter && shooterCooldown <= 0) {
        const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.4;
        const spd = 9 + Math.random() * 7;
        shooter = {
          x: Math.random() * canvas.width * 0.65,
          y: Math.random() * canvas.height * 0.45,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 0,
          maxLife: 35 + Math.random() * 25,
        };
        shooterCooldown = 280 + Math.random() * 450;
      }

      if (shooter) {
        const progress = shooter.life / shooter.maxLife;
        const alpha = Math.sin(progress * Math.PI) * 0.75;
        const tailX = shooter.x - shooter.vx * 7;
        const tailY = shooter.y - shooter.vy * 7;
        const grad = ctx.createLinearGradient(tailX, tailY, shooter.x, shooter.y);
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(1, `rgba(255,255,255,${alpha})`);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(shooter.x, shooter.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // tiny head glow
        ctx.beginPath();
        ctx.arc(shooter.x, shooter.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();

        shooter.x += shooter.vx;
        shooter.y += shooter.vy;
        shooter.life++;
        if (shooter.life >= shooter.maxLife) shooter = null;
      }

      raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      {/* Star canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none select-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      />

      {/* Orbiting Earth in bottom-right */}
      <div
        className="fixed pointer-events-none select-none"
        style={{ zIndex: 0, bottom: 48, right: 56 }}
        aria-hidden="true"
      >
        {/* Soft center glow (the "sun" reference point) */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 6, height: 6,
          marginTop: -3, marginLeft: -3,
          borderRadius: "50%",
          background: "rgba(255,180,60,0.45)",
          boxShadow: "0 0 14px 6px rgba(255,160,40,0.18)",
        }} />

        {/* Orbit ring */}
        <div style={{
          width: 88, height: 88,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.07)",
        }} />

        {/* Planet pivot — rotates at orbit center */}
        <div className="orbit-pivot" style={{
          position: "absolute",
          top: "50%", left: "50%",
        }}>
          {/* Earth */}
          <div className="orbit-planet" style={{
            position: "absolute",
            top: -44 - 8,  /* orbit radius + half planet size */
            left: -8,
            fontSize: 16,
            lineHeight: 1,
            filter: "drop-shadow(0 0 4px rgba(100,180,255,0.5))",
          }}>
            🌍
          </div>
        </div>
      </div>
    </>
  );
}
