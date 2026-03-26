import { useState, useEffect } from "react";

const DEFAULT_COLOR = "#d4a574";
const cache = new Map<string, string>();

/**
 * Extracts the dominant vibrant color from an album artwork URL.
 * Uses a downscaled canvas to sample pixels efficiently.
 */
export function useAlbumColor(imageUrl: string): string {
  const [color, setColor] = useState(() => cache.get(imageUrl) ?? DEFAULT_COLOR);

  useEffect(() => {
    if (!imageUrl) return;

    // Return cached result immediately
    if (cache.has(imageUrl)) {
      setColor(cache.get(imageUrl)!);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 64; // Small sample — plenty for color extraction
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      // Bucket pixels by hue, weighted by saturation + moderate brightness
      let bestR = 212, bestG = 165, bestB = 116; // fallback amber
      let bestScore = 0;

      // Sample every 4th pixel for speed
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lum = (max + min) / 2;
        const delta = max - min;

        // Skip very dark, very bright, or desaturated pixels
        if (lum < 30 || lum > 220 || delta < 25) continue;

        const sat = delta / (255 - Math.abs(2 * lum - 255));
        // Score: prefer saturated colors at moderate brightness
        const score = sat * (1 - Math.abs(lum - 120) / 120);

        if (score > bestScore) {
          bestScore = score;
          bestR = r;
          bestG = g;
          bestB = b;
        }
      }

      const extracted = `rgb(${bestR}, ${bestG}, ${bestB})`;
      cache.set(imageUrl, extracted);
      setColor(extracted);
    };

    img.src = imageUrl;
  }, [imageUrl]);

  return color;
}
