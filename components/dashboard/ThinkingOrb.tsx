"use client";
// Exported Z.ai adaptation of 21st.dev @anark17r/ai-thiking-orb-and-input (MIT).
// Particle geometry retained; scheduling now respects reduced motion and visibility.
import * as React from 'react';
import {cn} from '@/lib/utils';
const TAU = Math.PI * 2;
const RINGS = 16;

/** mulberry32 — deterministic PRNG, same seed recipe as the reference */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  a = (a + 0x6d2b79f5) | 0;
  return () => {
    a = Math.imul(a ^ (a >>> 15), 1 | a);
    a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
}

interface OrbPoint {
  x: number;
  y: number;
  z: number;
  /** 0 (top) … 1 (bottom) — drives the colour ramp */
  u: number;
  seed: number;
}

function buildPoints(): OrbPoint[] {
  const rnd = mulberry32(7);
  const pts: OrbPoint[] = [];
  for (let i = 0; i < RINGS; i++) {
    const o = 1 - ((i + 0.5) / RINGS) * 2; // −1…1 latitude
    const r = Math.sqrt(1 - o * o);
    const n = Math.max(4, Math.round(30 * r));
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + i * 0.35;
      pts.push({
        x: Math.cos(a) * r,
        y: o,
        z: Math.sin(a) * r,
        u: (1 - o) / 2,
        seed: rnd() * TAU,
      });
    }
  }
  return pts;
}

const POINTS = buildPoints();

/** cream → gold latitude ramp (reference lerps white → emerald) */
function rampColor(u: number, a: number): string {
  const r = Math.round(246 + (184 - 246) * u);
  const g = Math.round(231 + (150 - 231) * u);
  const b = Math.round(187 + (62 - 187) * u);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* ThinkingOrb — the canvas orb                                         */
/* ------------------------------------------------------------------ */

export type OrbMode = "idle" | "thinking";

/**
 * Canvas particle sphere. `mode="thinking"` spins it up, adds the vortex
 * swirl, the moving shimmer band and the breathing pulse; `mode="idle"`
 * is the slow desk-lamp rotation.
 */
export function ThinkingOrb({
  size = 170,
  mode = "idle",
  className,
}: {
  size?: number;
  mode?: OrbMode;
  className?: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const modeRef = React.useRef<OrbMode>(mode);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tiltCos = Math.cos(0.35);
    const tiltSin = Math.sin(0.35);
    const c = size / 2;
    const R = size * 0.34;

    let raf = 0;
    let last = performance.now();
    let rot = 0;
    let think = 0; // 0..1 eased engagement of the thinking dressing
    let disposed = false;
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");

    const frame = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const targetThink = modeRef.current === "thinking" ? 1 : 0;
      think += (targetThink - think) * Math.min(1, dt * 3.2);

      rot += lerp(0.22, 2.1, think) * dt;
      const vortex = rot + think * 1.4;
      const pulse = 1 + Math.sin(now / 320) * 0.03 * think;
      const sweepX = ((now / 1400) % 2 - 1) * 1.6; // −1.6 … 1.6 across the sphere

      ctx.clearRect(0, 0, size, size);

      /* centre glow */
      const glow = ctx.createRadialGradient(c, c, 0, c, c, R * 1.9);
      glow.addColorStop(0, `rgba(214,178,102,${0.20 + think * 0.16})`);
      glow.addColorStop(0.55, `rgba(184,150,62,${0.07 + think * 0.08})`);
      glow.addColorStop(1, "rgba(184,150,62,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      ctx.globalCompositeOperation = "lighter";

      for (const p of POINTS) {
        const wob = Math.sin(now / 900 + p.seed) * 0.035;
        const a = vortex + wob;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // rotate around Y, then a slight camera tilt around X
        const x1 = p.x * ca + p.z * sa;
        const z1 = -p.x * sa + p.z * ca;
        const y1 = p.y * tiltCos - z1 * tiltSin;
        const z2 = p.y * tiltSin + z1 * tiltCos;

        const depth = (z2 + 1) / 2; // 0 far … 1 near
        const px = c + x1 * R * pulse;
        const py = c + y1 * R * pulse;

        const spread = Math.abs(x1 - sweepX * think);
        const sweep = think * Math.max(0, 1 - spread * 4);

        const alpha = lerp(0.10, 0.92, depth) * (0.55 + 0.45 * think) + sweep * 0.75;
        const radius = lerp(0.55, 1.9, depth) + sweep * 0.6;

        ctx.fillStyle = sweep > 0.25 ? `rgba(255,244,214,${Math.min(1, alpha)})` : rampColor(p.u, alpha);
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, TAU);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      if(!reduced.matches&&!document.hidden)raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if(!reduced.matches) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const onMotion=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);};reduced.addEventListener("change",onMotion);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);reduced.removeEventListener("change",onMotion);
    };
  }, [size]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none", className)}
      style={{ width: size, height: size }}
    />
  );
}

