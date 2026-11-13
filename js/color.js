import { logger } from './logger.js';

export const PALETTE = [
  { hex: '#FFFFFF', label: 'Bianco' },
  { hex: '#FAF5E8', label: 'Avorio' },
  { hex: '#0D0D0D', label: 'Nero' },
  { hex: '#E63946', label: 'Rosso Editoriale' },
  { hex: '#FFB703', label: 'Ambra' },
  { hex: '#C5A059', label: 'Oro Champagne' },
  { hex: '#00F5D4', label: 'Ciano Neon' },
  { hex: '#CCFF00', label: 'Lime Acido' }
];

const CANDIDATES = [
  '#FFFFFF',
  '#0D0D0D',
  '#FAF5E8',
  '#FFD166',
  '#E63946',
  '#C5A059',
  '#00F5D4',
  '#111827'
];

export function hexToRgb(hex) {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r, g, b) {
  const toHex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function relativeLuminance({ r, g, b }) {
  const transform = v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function wcagContrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export class SceneColorSampler {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 48;
    this.canvas.height = 64;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.intervalId = null;
    this.lastResult = {
      dominantHex: '#222222',
      mastheadHex: '#FFFFFF',
      headlineHex: '#FFFFFF',
      mastheadRatio: 15.0,
      headlineRatio: 15.0
    };
  }

  sampleZone(data, width, height, yStartRatio, yEndRatio) {
    const y0 = Math.max(0, Math.floor(height * yStartRatio));
    const y1 = Math.min(height, Math.ceil(height * yEndRatio));
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (let y = y0; y < y1; y++) {
      for (let x = 4; x < width - 4; x++) {
        const idx = (y * width + x) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
    }

    if (count === 0) return { r: 34, g: 34, b: 34 };
    return {
      r: rSum / count,
      g: gSum / count,
      b: bSum / count
    };
  }

  pickBestContrast(bgRgb, preferredHex = '#FFFFFF') {
    const preferredRgb = hexToRgb(preferredHex);
    const preferredRatio = wcagContrastRatio(bgRgb, preferredRgb);
    if (preferredRatio >= 4.2) {
      return { hex: preferredHex, ratio: preferredRatio };
    }

    const whiteRgb = { r: 255, g: 255, b: 255 };
    const whiteRatio = wcagContrastRatio(bgRgb, whiteRgb);
    if (whiteRatio >= 4.2) {
      return { hex: '#FFFFFF', ratio: whiteRatio };
    }

    let bestHex = '#FFFFFF';
    let bestRatio = 0;

    for (const candidate of CANDIDATES) {
      const rgb = hexToRgb(candidate);
      const ratio = wcagContrastRatio(bgRgb, rgb);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestHex = candidate;
      }
    }

    return { hex: bestHex, ratio: bestRatio };
  }

  pickSceneAccent(fullBg, topBg, bottomBg, presetAccent = '#E63946') {
    const bgLum = relativeLuminance(bottomBg);
    const accentCandidates = [
      presetAccent,
      '#FFFFFF',
      '#E63946',
      '#FFB703',
      '#C5A059',
      '#0D0D0D'
    ];

    for (const hex of accentCandidates) {
      const rgb = hexToRgb(hex);
      const ratio = wcagContrastRatio(bottomBg, rgb);
      if (ratio >= 3.2) {
        return hex;
      }
    }
    return bgLum > 0.45 ? '#0D0D0D' : '#FFFFFF';
  }

  sampleSource(source, cropRect, preferredHex = '#FFFFFF', presetAccent = '#E63946') {
    if (!source || !cropRect || cropRect.sw <= 0 || cropRect.sh <= 0) {
      return this.lastResult;
    }

    try {
      const w = this.canvas.width;
      const h = this.canvas.height;
      this.ctx.drawImage(
        source,
        cropRect.sx,
        cropRect.sy,
        cropRect.sw,
        cropRect.sh,
        0,
        0,
        w,
        h
      );

      const imgData = this.ctx.getImageData(0, 0, w, h).data;
      const fullBg = this.sampleZone(imgData, w, h, 0.0, 1.0);
      const topBg = this.sampleZone(imgData, w, h, 0.03, 0.25);
      const bottomBg = this.sampleZone(imgData, w, h, 0.62, 0.92);

      const mastheadPick = this.pickBestContrast(topBg, preferredHex);
      const headlinePick = this.pickBestContrast(bottomBg, mastheadPick.hex);
      const accentHex = this.pickSceneAccent(fullBg, topBg, bottomBg, presetAccent);

      this.lastResult = {
        dominantHex: rgbToHex(fullBg.r, fullBg.g, fullBg.b),
        mastheadHex: mastheadPick.hex,
        headlineHex: headlinePick.hex,
        accentHex,
        mastheadRatio: Number(mastheadPick.ratio.toFixed(1)),
        headlineRatio: Number(headlinePick.ratio.toFixed(1))
      };
    } catch (err) {
      logger.warn('Errore campionamento colore scena', err);
    }

    return this.lastResult;
  }
}
