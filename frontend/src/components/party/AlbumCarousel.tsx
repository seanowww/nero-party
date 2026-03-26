import { useMemo } from "react";

/**
 * Ambient floating album atmosphere.
 *
 * Albums are scattered across the full viewport as individual particles,
 * each with its own position, size, blur, opacity, rotation, and slow
 * drift animation. Three depth layers (back / mid / fore) create
 * parallax. A strong radial vignette dissolves everything near center
 * so the CTA dominates.
 *
 * Pure CSS animations — no JS animation loop, no framer-motion.
 */

const ALBUMS = [
  "https://i.scdn.co/image/ab67616d00001e02db216ca805faf5fe35df4ee6",
  "https://i.scdn.co/image/ab67616d00001e02828e52cfb7bf22869349799e",
  "https://i.scdn.co/image/ab67616d00001e02c5649add07ed3720be9d5526",
  "https://i.scdn.co/image/ab67616d00001e027aede4855f6d0d738012e2e5",
  "https://i.scdn.co/image/ab67616d00001e02b53b9e1b4c119a73b5d2cbc5",
  "https://i.scdn.co/image/ab67616d00001e02bfcb8d00cee4f8257a6b7fe1",
  "https://i.scdn.co/image/ab67616d00001e0249efdc44d0733042f8b99d57",
  "https://i.scdn.co/image/ab67616d00001e02ac9fea717d5b78e73cbd89f6",
  "https://i.scdn.co/image/ab67616d00001e02f2e42d95613e6ef1a2bd19f0",
  "https://i.scdn.co/image/ab67616d00001e0278de8b28de36a74afc0348b5",
  "https://i.scdn.co/image/ab67616d00001e028b52c6b9bc4e43d873869699",
  "https://i.scdn.co/image/ab67616d00001e02cdb645498cd3d8a2db4d05e1",
  "https://i.scdn.co/image/ab67616d00001e0230a635de2bb0caa4e26f6abb",
  "https://i.scdn.co/image/ab67616d00001e028940ac99f49e44f59e6f7fb3",
  "https://i.scdn.co/image/ab67616d00001e02daec894c14c0ca42d76eeb32",
  "https://i.scdn.co/image/ab67616d00001e02d3b5affd8824b4ed301b7137",
  "https://i.scdn.co/image/ab67616d00001e02d9194aa18fa4c9362b47464f",
  "https://i.scdn.co/image/ab67616d00001e0226f7f19c7f0381e56156c94a",
  "https://i.scdn.co/image/ab67616d00001e02346d77e155d854735410ed18",
  "https://i.scdn.co/image/ab67616d00001e02aab2c3c3f1f3207137d915c9",
  "https://i.scdn.co/image/ab67616d00001e029e1cfc756886ac782e363d79",
  "https://i.scdn.co/image/ab67616d00001e02175c577a61aa13d4fb4b6534",
  "https://i.scdn.co/image/ab67616d00001e0206d56b057cce5797538a16d5",
  "https://i.scdn.co/image/ab67616d00001e028863bc11d2aa12b54f5aeb36",
  "https://i.scdn.co/image/ab67616d00001e029b9b36b0e22870b9f542d937",
];

// Deterministic PRNG
function prng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type DepthLayer = "back" | "mid" | "fore";

interface FloatingCover {
  url: string;
  // Position (% of viewport)
  x: number;
  y: number;
  // Visual
  size: number;       // px
  rotation: number;   // deg
  opacity: number;
  blur: number;       // px
  // Glow
  glowColor: string;
  glowOpacity: number;
  // Drift animation
  driftX: number;     // px to drift over one cycle
  driftY: number;     // px to drift over one cycle
  driftDuration: number; // seconds
  driftDelay: number;    // seconds — stagger start
  layer: DepthLayer;
}

// Warm-toned glow colors sampled to match the general album palette
const GLOW_COLORS = [
  "#1a1a4a", "#4a1a1a", "#1a3a2a", "#3a2a1a", "#2a1a3a",
  "#1a2a3a", "#3a1a2a", "#2a3a1a", "#1a1a2a", "#2a1a1a",
  "#3a3a1a", "#1a2a2a", "#2a2a3a", "#3a1a3a", "#1a3a3a",
];

const LAYER_CONFIG: Record<DepthLayer, {
  sizeRange: [number, number];
  opacityRange: [number, number];
  blurRange: [number, number];
  glowOpacity: number;
  driftRange: [number, number];    // px amplitude
  durationRange: [number, number]; // seconds
}> = {
  back: {
    sizeRange: [180, 280],
    opacityRange: [0.06, 0.10],
    blurRange: [10, 16],
    glowOpacity: 0.04,
    driftRange: [10, 30],
    durationRange: [40, 70],
  },
  mid: {
    sizeRange: [120, 200],
    opacityRange: [0.10, 0.18],
    blurRange: [4, 8],
    glowOpacity: 0.06,
    driftRange: [15, 40],
    durationRange: [30, 55],
  },
  fore: {
    sizeRange: [80, 150],
    opacityRange: [0.14, 0.24],
    blurRange: [1, 3],
    glowOpacity: 0.08,
    driftRange: [20, 50],
    durationRange: [25, 45],
  },
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function generateCovers(seed: number): FloatingCover[] {
  const rand = prng(seed);
  const covers: FloatingCover[] = [];

  // Distribute albums across layers: 8 back, 9 mid, 8 fore
  const layerAssign: DepthLayer[] = [
    ...Array(8).fill("back" as const),
    ...Array(9).fill("mid" as const),
    ...Array(8).fill("fore" as const),
  ];

  // Shuffle layer assignments
  for (let i = layerAssign.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [layerAssign[i], layerAssign[j]] = [layerAssign[j], layerAssign[i]];
  }

  for (let i = 0; i < ALBUMS.length; i++) {
    const layer = layerAssign[i];
    const cfg = LAYER_CONFIG[layer];
    const t = rand();

    // Position: scatter across full viewport
    // Avoid dead center (30-70% x, 30-70% y) for most covers
    let x = rand() * 100;
    let y = rand() * 100;

    // Push covers that land near center outward
    const dx = x - 50;
    const dy = y - 50;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    if (distFromCenter < 25) {
      const angle = Math.atan2(dy, dx);
      const pushDist = 25 + rand() * 15;
      x = 50 + Math.cos(angle) * pushDist;
      y = 50 + Math.sin(angle) * pushDist;
    }

    // Allow some to be partially off-screen
    x = Math.max(-8, Math.min(108, x));
    y = Math.max(-8, Math.min(108, y));

    const size = lerp(cfg.sizeRange[0], cfg.sizeRange[1], t);
    const opacity = lerp(cfg.opacityRange[0], cfg.opacityRange[1], rand());
    const blur = lerp(cfg.blurRange[0], cfg.blurRange[1], rand());
    const rotation = (rand() - 0.5) * 5; // ±2.5 deg

    // Drift: each cover gets a unique direction and speed
    const driftAngle = rand() * Math.PI * 2;
    const driftAmp = lerp(cfg.driftRange[0], cfg.driftRange[1], rand());
    const driftX = Math.cos(driftAngle) * driftAmp;
    const driftY = Math.sin(driftAngle) * driftAmp;
    const driftDuration = lerp(cfg.durationRange[0], cfg.durationRange[1], rand());
    const driftDelay = rand() * -driftDuration; // negative = start mid-animation

    const glowColor = GLOW_COLORS[i % GLOW_COLORS.length];

    covers.push({
      url: ALBUMS[i],
      x, y, size, rotation, opacity, blur,
      glowColor,
      glowOpacity: cfg.glowOpacity,
      driftX, driftY, driftDuration, driftDelay,
      layer,
    });
  }

  return covers;
}

// Each cover gets a unique @keyframes name via inline style animation
// The keyframe is: translate from (0,0) → (driftX, driftY) → (0,0) with
// slight easing variation per cover.
function coverAnimStyle(cover: FloatingCover): React.CSSProperties {
  // We use a CSS custom property trick: animate with a single keyframe
  // defined inline. Since we can't inject @keyframes per element, we use
  // the `offset-path` trick or simply use `animation` with the shared
  // keyframe and vary via translate in the element's own transform.
  //
  // Actually the cleanest pure-CSS approach: use a shared "albumFloat"
  // keyframe that goes 0% → 50% → 100% as (0,0) → (1,1) → (0,0) and
  // multiply by the cover's drift via CSS custom properties.
  return {
    position: "absolute" as const,
    left: `${cover.x}%`,
    top: `${cover.y}%`,
    width: cover.size,
    height: cover.size,
    opacity: cover.opacity,
    filter: `blur(${cover.blur}px)`,
    transform: `translate(-50%, -50%) rotate(${cover.rotation}deg)`,
    // Custom properties for the keyframe to read
    "--drift-x": `${cover.driftX}px`,
    "--drift-y": `${cover.driftY}px`,
    animation: `albumFloat ${cover.driftDuration}s ease-in-out ${cover.driftDelay}s infinite`,
    willChange: "transform",
    zIndex: cover.layer === "back" ? 0 : cover.layer === "mid" ? 1 : 2,
  } as React.CSSProperties;
}

export default function AlbumCarousel() {
  const covers = useMemo(() => generateCovers(42), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating album covers */}
      {covers.map((cover, i) => (
        <div key={i} style={coverAnimStyle(cover)}>
          {/* Glow behind cover */}
          <div
            className="absolute -inset-4 rounded-2xl"
            style={{
              background: `radial-gradient(circle, ${cover.glowColor} 0%, transparent 70%)`,
              opacity: cover.glowOpacity,
              filter: "blur(12px)",
            }}
          />
          {/* Album art */}
          <div
            className="relative w-full h-full rounded-lg overflow-hidden"
            style={{
              boxShadow: `0 8px 40px rgba(0,0,0,0.5)`,
            }}
          >
            <img
              src={cover.url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
          </div>
        </div>
      ))}

      {/* Vignette: edges dissolve to void */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(to right, #0a0a0a 0%, transparent 18%, transparent 82%, #0a0a0a 100%),
            linear-gradient(to bottom, #0a0a0a 0%, transparent 15%, transparent 85%, #0a0a0a 100%)
          `,
        }}
      />

      {/* Center void — albums fade into darkness around CTA */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 42% 38% at 50% 50%, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.6) 35%, rgba(10,10,10,0.15) 65%, transparent 100%)",
        }}
      />
    </div>
  );
}
