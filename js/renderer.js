import { hexToRgb, relativeLuminance } from './color.js';

export const FORMATS = {
  magazine: { id: 'magazine', label: 'Magazine', ratio: 4 / 5.3, desc: '4:5.3' },
  post: { id: 'post', label: 'Post 4:5', ratio: 4 / 5, desc: '4:5' },
  story: { id: 'story', label: 'Story 9:16', ratio: 9 / 16, desc: '9:16' }
};

export function computeCropRect(sourceWidth, sourceHeight, targetRatio) {
  if (!sourceWidth || !sourceHeight) {
    return { sx: 0, sy: 0, sw: 1, sh: 1 };
  }
  const sourceRatio = sourceWidth / sourceHeight;
  let sw = sourceWidth;
  let sh = sourceHeight;
  let sx = 0;
  let sy = 0;

  if (sourceRatio > targetRatio) {
    sw = Math.round(sourceHeight * targetRatio);
    sx = Math.round((sourceWidth - sw) / 2);
  } else if (sourceRatio < targetRatio) {
    sh = Math.round(sourceWidth / targetRatio);
    sy = Math.round((sourceHeight - sh) / 2);
  }

  return { sx, sy, sw, sh };
}

// Digital zoom uses the same centered source crop as CSS object-fit: cover.
// Keeping this calculation shared prevents a preview/export framing mismatch.
export function computeZoomCropRect(sourceWidth, sourceHeight, targetRatio, zoom = 1) {
  const base = computeCropRect(sourceWidth, sourceHeight, targetRatio);
  const safeZoom = Math.max(1, Math.min(3, Number(zoom) || 1));
  const sw = base.sw / safeZoom;
  const sh = base.sh / safeZoom;
  return {
    sx: base.sx + (base.sw - sw) / 2,
    sy: base.sy + (base.sh - sh) / 2,
    sw,
    sh
  };
}

function adaptElementPosition(el, formatId, showSafeZones) {
  let y = el.y;
  let size = el.size;

  if (formatId === 'story') {
    const topSafe = showSafeZones ? 0.12 : 0.06;
    const bottomSafe = showSafeZones ? 0.84 : 0.92;
    const span = bottomSafe - topSafe;
    y = topSafe + ((el.y - 0.035) / 0.90) * span;
    size = el.size * 0.96;
  } else if (formatId === 'post') {
    y = 0.03 + ((el.y - 0.035) / 0.90) * 0.91;
    size = el.size * 0.97;
  }

  return { y, size };
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function resolveFontStack(fontName) {
  if (!fontName) return 'sans-serif';
  if (fontName === 'Futura') {
    return '"Futura", "Jost", "League Spartan", sans-serif';
  }
  if (fontName === 'Helvetica Neue') {
    return '"Helvetica Neue", "Inter", "Work Sans", sans-serif';
  }
  const serifFamilies = new Set(['Bodoni Moda', 'Playfair Display', 'Cormorant Garamond', 'Cinzel', 'Newsreader']);
  const fallback = serifFamilies.has(fontName) ? 'serif' : 'sans-serif';
  return `"${fontName}", ${fallback}`;
}

export const COMPOSITION_GUIDES = [
  { id: 'none', label: 'Nessuna' },
  { id: 'typo-grid', label: 'Griglia Tipografica' },
  { id: 'golden-spiral', label: 'Spirale Aurea' },
  { id: 'phi-grid', label: 'Griglia Aurea (Phi)' },
  { id: 'thirds', label: 'Regola dei Terzi' },
  { id: 'diagonals', label: 'Diagonali & Centro' }
];

export const IMAGE_FILTERS = [
  { id: 'none', label: 'Naturale', css: 'none' },
  { id: 'auto-genre', label: 'Look Genere (Auto)', css: 'auto' },
  { id: 'bw-editorial', label: 'B/N Editoriale', css: 'grayscale(100%) contrast(1.24) brightness(0.98)' },
  { id: 'fashion-gloss', label: 'Moda Editorial', css: 'contrast(1.14) saturate(1.08) brightness(1.03) sepia(0.08)' },
  { id: 'news-grit', label: 'Reportage News', css: 'contrast(1.28) saturate(0.72) brightness(0.96)' },
  { id: 'product-crisp', label: 'Studio Prodotto', css: 'contrast(1.16) saturate(1.18) brightness(1.04)' },
  { id: 'luxury-velvet', label: 'Oro & Lusso', css: 'sepia(0.22) contrast(1.15) saturate(1.12) brightness(0.97)' }
];

export const GENRE_FILTER_MAP = {
  fashion: 'fashion-gloss',
  news: 'news-grit',
  product: 'product-crisp',
  luxury: 'luxury-velvet',
  design: 'product-crisp',
  music: 'bw-editorial',
  sport: 'news-grit'
};

export function resolveFilterCss(filterId, currentGenre, toneAdjust = { contrast: 100, brightness: 100 }) {
  let base = '';
  if (filterId && filterId !== 'none') {
    let targetId = filterId;
    if (filterId === 'auto-genre') {
      targetId = GENRE_FILTER_MAP[currentGenre] || 'fashion-gloss';
    }
    const found = IMAGE_FILTERS.find(f => f.id === targetId);
    if (found && found.css !== 'auto' && found.css !== 'none') {
      base = found.css;
    }
  }

  const c = toneAdjust && typeof toneAdjust.contrast === 'number' ? toneAdjust.contrast : 100;
  const b = toneAdjust && typeof toneAdjust.brightness === 'number' ? toneAdjust.brightness : 100;
  const extra = [];
  if (c !== 100) extra.push(`contrast(${(c / 100).toFixed(2)})`);
  if (b !== 100) extra.push(`brightness(${(b / 100).toFixed(2)})`);

  const combined = [base, ...extra].filter(Boolean).join(' ').trim();
  return combined || 'none';
}

export const GRADING_TRIADS = [
  { id: 'glam-vogue', genre: 'fashion', label: 'Glamour Rose & Noir', c60: '#1C0D18', c30: '#F3D1DC', c10: '#FF2A6D' },
  { id: 'amber-couture', genre: 'fashion', label: 'Couture Ambra', c60: '#1F130B', c30: '#F2C18D', c10: '#FF5E00' },
  { id: 'news-cinema', genre: 'news', label: 'Cinema Teal & Red', c60: '#0D1F2D', c30: '#E5E7EB', c10: '#E10600' },
  { id: 'prod-titanium', genre: 'product', label: 'Cyber Titanium', c60: '#0F172A', c30: '#94A3B8', c10: '#00F5D4' },
  { id: 'lux-imperial', genre: 'luxury', label: 'Imperial Gold', c60: '#14110B', c30: '#E6D2AA', c10: '#D4AF37' },
  { id: 'des-bauhaus', genre: 'design', label: ' Terracotta Studio', c60: '#1D211E', c30: '#EAE2D6', c10: '#E05A47' },
  { id: 'mus-neon', genre: 'music', label: 'Velvet Club', c60: '#150826', c30: '#C77DFF', c10: '#CCFF00' },
  { id: 'spt-volt', genre: 'sport', label: 'Nitro Arena', c60: '#0B1320', c30: '#70E000', c10: '#FF0055' }
];

export const LIGHT_BLEND_MODES = [
  { id: 'multiply', label: 'Multiply' },
  { id: 'difference', label: 'Difference' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'soft-light', label: 'Soft Light' },
  { id: 'color-burn', label: 'Color Burn' },
  { id: 'exclusion', label: 'Exclusion' }
];

export function renderColorGrading603010(ctx, width, height, grading) {
  if (!grading || !grading.enabled) return;
  const strength = typeof grading.strength === 'number' ? grading.strength : 0.55;
  if (strength <= 0.01) return;

  const blendMode = grading.blendMode || 'multiply';
  const rgb60 = hexToRgb(grading.c60 || '#1C0D18');
  const rgb30 = hexToRgb(grading.c30 || '#F3D1DC');
  const rgb10 = hexToRgb(grading.c10 || '#FF2A6D');

  ctx.save();

  ctx.save();
  ctx.globalCompositeOperation = blendMode;
  const baseGrad = ctx.createLinearGradient(0, height, 0, 0);
  baseGrad.addColorStop(0, `rgba(${rgb60.r}, ${rgb60.g}, ${rgb60.b}, ${(0.76 * strength).toFixed(3)})`);
  baseGrad.addColorStop(0.55, `rgba(${rgb60.r}, ${rgb60.g}, ${rgb60.b}, ${(0.35 * strength).toFixed(3)})`);
  baseGrad.addColorStop(1, `rgba(${rgb30.r}, ${rgb30.g}, ${rgb30.b}, ${(0.48 * strength).toFixed(3)})`);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = blendMode;
  const warmHalo = ctx.createRadialGradient(
    width * 0.5,
    height * 0.38,
    width * 0.14,
    width * 0.5,
    height * 0.42,
    width * 0.78
  );
  warmHalo.addColorStop(0, 'rgba(255, 255, 255, 0)');
  warmHalo.addColorStop(0.58, `rgba(${rgb30.r}, ${rgb30.g}, ${rgb30.b}, ${(0.38 * strength).toFixed(3)})`);
  warmHalo.addColorStop(1, `rgba(${rgb60.r}, ${rgb60.g}, ${rgb60.b}, ${(0.72 * strength).toFixed(3)})`);
  ctx.fillStyle = warmHalo;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = blendMode;
  const accentWash = ctx.createLinearGradient(0, 0, width, height * 0.7);
  accentWash.addColorStop(0, `rgba(${rgb10.r}, ${rgb10.g}, ${rgb10.b}, ${(0.28 * strength).toFixed(3)})`);
  accentWash.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = accentWash;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.restore();
}

export function renderLightSpots(ctx, width, height, spots = [], isExport = false, blendMode = 'multiply', grading = null) {
  if (!spots || !spots.length) return;
  const rgb30 = hexToRgb((grading && grading.c30) || '#F2C18D');
  const rgb60 = hexToRgb((grading && grading.c60) || '#1F130B');
  const rgb10 = hexToRgb((grading && grading.c10) || '#FF5E00');

  ctx.save();
  for (const spot of spots) {
    const cx = spot.x * width;
    const cy = spot.y * height;
    const radius = (spot.radius || 0.34) * Math.min(width, height);
    const intensity = spot.intensity ?? 0.48;
    const customHaloColor = typeof spot.color === 'string' && /^#[0-9a-f]{6}$/i.test(spot.color)
      ? hexToRgb(spot.color) : null;
    const haloCore = customHaloColor || rgb30;
    const haloEdge = customHaloColor || rgb10;
    const mode = spot.blendMode || blendMode || 'multiply';

    ctx.save();
    ctx.globalCompositeOperation = mode;

    const addEased = (grad, stops) => {
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const eased = 1 - (t * t * (3 - 2 * t));
        const c = stops(t);
        grad.addColorStop(t, `rgba(${c.r}, ${c.g}, ${c.b}, ${(c.a * eased).toFixed(4)})`);
      }
    };

    if (mode === 'multiply' || mode === 'color-burn') {
      const outer = radius * 1.9;
      const mulGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer);
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const k = t * t * (3 - 2 * t);
        const a = Math.min(1, intensity * 0.88) * (1 - k);
        mulGrad.addColorStop(t, `rgba(${haloCore.r}, ${haloCore.g}, ${haloCore.b}, ${a.toFixed(4)})`);
      }
      ctx.fillStyle = mulGrad;
      ctx.fillRect(0, 0, width, height);
    } else {
      const outer = radius * 1.9;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer);
      addEased(grad, (t) => {
        const r = Math.round(haloCore.r + (haloEdge.r - haloCore.r) * Math.min(1, t * 1.6));
        const g = Math.round(haloCore.g + (haloEdge.g - haloCore.g) * Math.min(1, t * 1.6));
        const bl = Math.round(haloCore.b + (haloEdge.b - haloCore.b) * Math.min(1, t * 1.6));
        return { r, g, b: bl, a: Math.min(1, intensity * 0.85) };
      });
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (!isExport) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = spot.color || 'rgba(255, 42, 109, 0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

export function renderCoverOverlay(ctx, width, height, preset, options) {
  if (!preset) return;

  const {
    formatId = 'magazine',
    editorialLineGap = 1,
    opacity = 1,
    colorMode = 'auto',
    manualColor = null,
    autoColors = { mastheadHex: '#FFFFFF', headlineHex: '#FFFFFF', accentHex: null },
    showSafeZones = false,
    horizon = { enabled: false, angle: 0, isLevel: true },
    lightSpots = [],
    lightBlendMode = 'multiply',
    faceCutout = { enabled: false, zone: null },
    grading = null,
    compositionGuide = 'none',
    isExport = false
  } = options;

  renderColorGrading603010(ctx, width, height, grading);
  renderLightSpots(ctx, width, height, lightSpots, isExport, lightBlendMode, grading);

  ctx.save();
  ctx.globalAlpha = opacity;

  const isGradingActive = Boolean(grading && grading.enabled);

  const primaryColor = colorMode === 'manual' && manualColor
    ? manualColor
    : (colorMode === 'auto' ? autoColors.mastheadHex : (preset.defaultColor || '#FFFFFF'));

  const secondaryColor = colorMode === 'manual' && manualColor
    ? manualColor
    : (colorMode === 'auto' ? autoColors.headlineHex : (preset.defaultColor || '#FFFFFF'));

  const accentColor = colorMode === 'manual' && manualColor
    ? manualColor
    : (isGradingActive && grading.c10
      ? grading.c10
      : (colorMode === 'auto' && autoColors.accentHex ? autoColors.accentHex : (preset.accentColor || '#E63946')));

  if (preset.frame) {
    const inset = preset.frame.inset * width;
    const lineW = (preset.frame.width || 1.5) * (width / 420);
    ctx.save();
    ctx.strokeStyle = preset.frame.colorRole === 'accent' ? accentColor : primaryColor;
    ctx.lineWidth = lineW;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    ctx.restore();
  }

  let prevFlowBottom = null;
  let prevAlign = null;
  const placedBoxes = [];
  // The bottom caption is a fixed editorial zone, not a free-floating text box.
  // Reserve it before laying out headlines and supporting stories.
  const footerElement = preset.elements.find(item => item.role === 'cta' && typeof item.text === 'string');
  let footerReserve = null;
  if (footerElement) {
    const { y: footerY } = adaptElementPosition(footerElement, formatId, showSafeZones);
    const x = footerElement.x * width;
    const w = Math.min(footerElement.w || 0.88, 0.88) * width;
    const left = footerElement.align === 'center' ? x - w / 2
      : footerElement.align === 'right' ? x - w : x;
    const top = footerY * height - (footerElement.ruleTop ? width * 0.04 : 0) - width * 0.025;
    footerReserve = { role: 'footer-reserve', left, right: left + w, top, bottom: height };
  }

  for (const el of preset.elements) {
    if (typeof el.text !== 'string' || !el.text.trim()) continue;
    const { y: adaptedY, size: adaptedSize } = adaptElementPosition(el, formatId, showSafeZones);
    let fontPx = Math.max(11, Math.round(adaptedSize * width));
    const fontStyle = el.italic ? 'italic' : 'normal';
    const fontWeight = el.weight || '400';
    const fontFamily = resolveFontStack(el.font);

    ctx.save();
    ctx.font = `${fontStyle} ${fontWeight} ${fontPx}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = el.align || 'left';

    if ('letterSpacing' in ctx) {
      const trackPx = (el.tracking || 0) * fontPx;
      ctx.letterSpacing = `${trackPx.toFixed(2)}px`;
    }

    const rawText = el.uppercase ? el.text.toUpperCase() : el.text;
    const isEditorialBoxRole = el.role === 'lead' || el.role === 'body';
    const isSingleLineBarRole = el.role === 'masthead' || el.role === 'issue' || el.role === 'cta' || el.role === 'kicker';
    const defaultColW = isEditorialBoxRole
      ? (el.align === 'center' ? 0.66 : 0.52)
      : 0.88;
    const maxW = Math.min(el.w || defaultColW, isEditorialBoxRole ? 0.74 : 0.88) * width;
    let xPos = el.x * width;
    let yPos = adaptedY * height;

    if (isSingleLineBarRole) {
      const measured = ctx.measureText(rawText).width;
      const targetMax = el.bg === 'accent' ? Math.max(20, maxW - fontPx * 1.3) : maxW;
      if (measured > targetMax && measured > 0) {
        const minPx = el.role === 'masthead' ? 16 : 9;
        fontPx = Math.max(minPx, Math.floor(fontPx * (targetMax / measured)));
        ctx.font = `${fontStyle} ${fontWeight} ${fontPx}px ${fontFamily}`;
        if ('letterSpacing' in ctx) {
          const trackPx = (el.tracking || 0) * fontPx;
          ctx.letterSpacing = `${trackPx.toFixed(2)}px`;
        }
      }
    }

    let lines = isSingleLineBarRole ? [rawText] : wrapLines(ctx, rawText, maxW);
    if (isEditorialBoxRole && lines.length > (el.maxLines || 3)) {
      lines = lines.slice(0, el.maxLines || 3);
    }
    // A consistent editorial baseline grid, with distinct leading for every content role.
    const leadingByRole = { masthead: 1.0, issue: 1.2, kicker: 1.28, headline: 1.38, lead: 1.54, body: 1.56, cta: 1.2 };
    const defaultLeading = leadingByRole[el.role] || 1.3;
    // Animal editorial covers use their authored leading for headlines and
    // summaries. All other genres keep the established role-based minimum.
    const compactAnimalRole = preset.genre === 'animals' && (el.role === 'headline' || el.role === 'lead');
    const effectiveLeading = compactAnimalRole
      ? (Number(el.lineHeight) || defaultLeading)
      : Math.max(defaultLeading, el.lineHeight || 0);
    const lineH = fontPx * Math.max(1.12, effectiveLeading * Math.max(0.9, Math.min(1.65, editorialLineGap)));
    const inkHeight = (lines.length - 1) * lineH + fontPx;
    const boxPadY = el.box === 'frame' || el.box === 'bracket' ? width * 0.014 : (el.box === 'bar' ? width * 0.007 : 0);
    const blockH = el.bg === 'accent' ? fontPx * 1.25 : inkHeight + (boxPadY ? boxPadY + Math.max(0, lineH - fontPx) : 0);
    // Rule clearance is reserved before placement, not added after collision checks.
    const lineClearance = el.ruleTop ? width * (el.role === 'issue' ? 0.018 : el.role === 'cta' ? 0.04 : 0.028) : 0;

    // Collisions use measured text width, not the entire wrap column.
    // Decorative strokes and frames extend those bounds explicitly.
    const measuredW = Math.max(0, ...lines.map(line => ctx.measureText(line).width));
    const inkW = el.bg === 'accent'
      ? Math.min(maxW, measuredW + fontPx * 1.2)
      : measuredW;
    let boxLeft = xPos;
    if (el.align === 'center') boxLeft = xPos - inkW / 2;
    else if (el.align === 'right') boxLeft = xPos - inkW;
    let boxRight = boxLeft + inkW;
    if (el.ruleTop) {
      const ruleLeft = el.align === 'center' ? xPos - maxW / 2
        : el.align === 'right' ? xPos - maxW : xPos;
      boxLeft = Math.min(boxLeft, ruleLeft);
      boxRight = Math.max(boxRight, ruleLeft + maxW);
    }
    if (el.box === 'bar') {
      const barOffset = Math.max(2, width * 0.0055) + fontPx * 0.52;
      if (el.align === 'right') boxLeft -= barOffset;
      else boxRight += barOffset;
    } else if (el.box === 'frame' || el.box === 'bracket') {
      const frameW = Math.min(maxW, Math.max(measuredW, maxW * 0.65));
      const padX = fontPx * 0.52;
      const frameLeft = el.align === 'center' ? xPos - frameW / 2 - padX
        : el.align === 'right' ? xPos - frameW - padX : xPos - padX;
      boxLeft = Math.min(boxLeft, frameLeft);
      boxRight = Math.max(boxRight, frameLeft + frameW + padX * 2);
    }

    const isFlowRole = el.role === 'kicker' || el.role === 'headline' || el.role === 'lead' || el.role === 'body';
    if (
      isFlowRole &&
      (el.role === 'lead' || el.role === 'body' || el.role === 'headline') &&
      prevFlowBottom !== null &&
      prevAlign === (el.align || 'left') &&
      Math.abs(yPos - prevFlowBottom) < height * 0.16
    ) {
      yPos = Math.max(yPos, prevFlowBottom + fontPx * (el.role === 'headline' ? 0.4 : 0.65));
    }

    // Shared editorial rhythm: spacing is defined in cover units rather than accidental font sizes.
    const gapScale = el.role === 'lead' ? 0.72 : el.role === 'body' ? 0.65 : el.role === 'headline' ? 0.52 : 0.4;
    const minGap = Math.max(width * 0.025, fontPx * gapScale);
    const topInset = Math.max(lineClearance, boxPadY, el.bg === 'accent' ? fontPx * 0.2 : 0);
    const targetY = yPos;
    const bottomLimit = height * 0.956;
    const topLimit = width * 0.018;
    const obstacles = el.role === 'cta' || !footerReserve
      ? placedBoxes
      : [...placedBoxes, footerReserve];
    const intersectsHorizontally = b =>
      Math.min(boxRight, b.right) - Math.max(boxLeft, b.left) > width * 0.025;
    const collisionsAt = top => obstacles.filter(b =>
      intersectsHorizontally(b) &&
      top - topInset < b.bottom + minGap &&
      top + blockH > b.top - minGap
    );

    // Preserve each role's authored vertical region and never move the footer
    // into the photograph's main-story area to make a collision disappear.
    const hardMin = topLimit + topInset;
    const hardMax = bottomLimit - blockH;
    const band = el.role === 'masthead' || el.role === 'issue' ? height * 0.055
      : el.role === 'cta' ? height * 0.07 : height * 0.15;
    const bandMin = el.role === 'cta' ? height * 0.83 : targetY - band;
    const bandMax = targetY + band;
    const minY = Math.max(hardMin, bandMin);
    const maxY = Math.min(hardMax, bandMax);
    const candidates = new Set([targetY, minY, maxY]);
    for (const b of obstacles) {
      candidates.add(b.bottom + minGap + topInset);
      candidates.add(b.top - minGap - blockH);
    }
    // Search intermediate positions, not only the edges of other boxes.
    for (let step = minY; step <= maxY; step += editorialLineGap * width * 0.009) {
      candidates.add(step);
    }
    const inRange = top => Number.isFinite(top) && top >= minY - 0.5 && top <= maxY + 0.5;
    const best = [...candidates].filter(inRange).filter(top => collisionsAt(top).length === 0)
      .sort((a, b) => Math.abs(a - targetY) - Math.abs(b - targetY));
    yPos = best.length ? best[0] : Math.max(hardMin, Math.min(targetY, hardMax));
    if (!best.length && minY <= maxY) {
      // If a preset is genuinely overcrowded, keep the text near its authored
      // area and minimize the obstruction instead of teleporting the footer.
      const overlapCost = top => obstacles.reduce((sum, b) => {
        if (!intersectsHorizontally(b)) return sum;
        const shared = Math.min(top + blockH, b.bottom) - Math.max(top - topInset, b.top);
        return sum + Math.max(0, shared);
      }, 0);
      yPos = [...candidates].filter(inRange)
        .sort((a, b) =>
          overlapCost(a) - overlapCost(b) ||
          Math.abs(a - targetY) - Math.abs(b - targetY)
        )[0] ?? yPos;
    }

    let fillColor = secondaryColor;
    if (el.role === 'masthead' || el.role === 'issue') {
      fillColor = primaryColor;
    }
    if (el.colorRole === 'accent') {
      fillColor = accentColor;
    }

    if (el.ruleTop) {
      ctx.save();
      ctx.strokeStyle = fillColor;
      ctx.globalAlpha = opacity * 0.55;
      ctx.lineWidth = Math.max(1, width * 0.0022);
      const ruleY = yPos - lineClearance;
      let rx0 = xPos;
      if (el.align === 'center') rx0 = xPos - maxW / 2;
      else if (el.align === 'right') rx0 = xPos - maxW;
      ctx.beginPath();
      ctx.moveTo(rx0, ruleY);
      ctx.lineTo(rx0 + maxW, ruleY);
      ctx.stroke();
      ctx.restore();
    }

    if (el.bg === 'accent') {
      const textMetrics = ctx.measureText(lines[0] || rawText);
      const pillW = Math.min(maxW, textMetrics.width + fontPx * 1.2);
      const pillH = fontPx * 1.45;
      let bx = xPos;
      if (el.align === 'center') bx = xPos - pillW / 2;
      else if (el.align === 'right') bx = xPos - pillW;

      ctx.save();
      ctx.fillStyle = accentColor;
      ctx.fillRect(bx, yPos - fontPx * 0.2, pillW, pillH);
      ctx.restore();

      const lum = relativeLuminance(hexToRgb(accentColor));
      fillColor = lum > 0.42 ? '#0D0D0D' : '#FFFFFF';
      placedBoxes.push({
        role: el.role,
        left: bx,
        right: bx + pillW,
        top: yPos - fontPx * 0.2,
        bottom: yPos - fontPx * 0.2 + pillH
      });
      if (el.align === 'left') {
        ctx.fillStyle = fillColor;
        ctx.fillText(lines[0], bx + fontPx * 0.6, yPos);
        if (isFlowRole) {
          prevFlowBottom = yPos + pillH;
          prevAlign = el.align || 'left';
        }
        ctx.restore();
        continue;
      } else if (el.align === 'right') {
        ctx.fillStyle = fillColor;
        ctx.fillText(lines[0], bx + pillW - fontPx * 0.6, yPos);
        if (isFlowRole) {
          prevFlowBottom = yPos + pillH;
          prevAlign = el.align || 'right';
        }
        ctx.restore();
        continue;
      } else {
        ctx.fillStyle = fillColor;
        ctx.fillText(lines[0], xPos, yPos);
        if (isFlowRole) {
          prevFlowBottom = yPos + pillH;
          prevAlign = 'center';
        }
        ctx.restore();
        continue;
      }
    }

    if (isEditorialBoxRole && el.box && lines.length > 0) {
      let maxLineW = 0;
      for (const l of lines) {
        maxLineW = Math.max(maxLineW, ctx.measureText(l).width);
      }
      const boxW = Math.min(maxW, Math.max(maxLineW, maxW * 0.65));
      const boxH = inkHeight;
      const padX = Math.max(fontPx * 0.58, width * 0.012);
      const padY = boxPadY;

      ctx.save();
      if (el.box === 'bar') {
        ctx.fillStyle = accentColor;
        const barW = Math.max(2, width * 0.0055);
        if ((el.align || 'left') === 'left') {
          ctx.fillRect(xPos, yPos - fontPx * 0.08, barW, boxH);
          xPos += barW + padX;
        } else if (el.align === 'right') {
          ctx.fillRect(xPos - barW, yPos - fontPx * 0.08, barW, boxH);
          xPos -= (barW + padX);
        }
      } else if (el.box === 'bracket' || el.box === 'frame') {
        let bx = xPos;
        if (el.align === 'center') bx = xPos - boxW / 2;
        else if (el.align === 'right') bx = xPos - boxW;
        ctx.strokeStyle = fillColor;
        ctx.globalAlpha = opacity * 0.38;
        ctx.lineWidth = Math.max(1, width * 0.0022);
        if (el.box === 'frame') {
          ctx.strokeRect(bx - padX, yPos - padY, boxW + padX * 2, boxH + padY * 1.6);
        } else {
          ctx.beginPath();
          ctx.moveTo(bx, yPos - padY);
          ctx.lineTo(bx + boxW, yPos - padY);
          ctx.moveTo(bx, yPos + boxH + padY * 0.4);
          ctx.lineTo(bx + boxW, yPos + boxH + padY * 0.4);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    ctx.fillStyle = fillColor;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], xPos, yPos + i * lineH);
    }

    if (el.role === 'masthead' && faceCutout && faceCutout.enabled && faceCutout.zone) {
      const z = faceCutout.zone;
      const cx = z.x * width;
      const cy = z.y * height;
      const rx = (z.rx || 0.24) * width;
      const ry = (z.ry || 0.20) * height;
      const feather = typeof z.feather === 'number' ? z.feather : 0.72;
      const maxR = Math.max(rx, ry);
      const innerR = Math.max(2, maxR * (1 - feather));

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const cutGrad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, maxR);
      cutGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      cutGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.82)');
      cutGrad.addColorStop(0.78, 'rgba(0, 0, 0, 0.35)');
      cutGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cutGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    placedBoxes.push({
      role: el.role,
      left: boxLeft,
      right: boxRight,
      top: yPos - topInset,
      bottom: yPos + blockH
    });

    if (isFlowRole) {
      prevFlowBottom = yPos + blockH;
      prevAlign = el.align || 'left';
    } else {
      prevFlowBottom = null;
    }

    ctx.restore();
  }

  if (!isExport && faceCutout && faceCutout.enabled && faceCutout.zone) {
    const z = faceCutout.zone;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(z.x * width, z.y * height, (z.rx || 0.24) * width, (z.ry || 0.20) * height, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(z.x * width, z.y * height, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  if (!isExport && compositionGuide && compositionGuide !== 'none') {
    drawCompositionGuide(ctx, width, height, compositionGuide, placedBoxes);
  }

  if (!isExport && showSafeZones && formatId === 'story') {
    drawStorySafeZones(ctx, width, height);
  }

  if (!isExport && horizon && horizon.enabled) {
    drawHorizonLine(ctx, width, height, horizon.angle, horizon.isLevel);
  }
}

function drawCompositionGuide(ctx, width, height, guideId, placedBoxes = []) {
  ctx.save();
  const strokeMain = 'rgba(255, 215, 0, 0.55)';
  const strokeSub = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(1.2, width * 0.0028);

  if (guideId === 'typo-grid') {
    const mX = width * 0.06;
    const mTop = height * 0.04;
    const mBot = height * 0.94;
    const innerW = width * 0.88;
    const gutter = width * 0.02;
    const cols = 6;
    const colW = (innerW - gutter * (cols - 1)) / cols;

    ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let c = 0; c < cols; c++) {
      const cx = mX + c * (colW + gutter);
      ctx.fillRect(cx, mTop, colW, mBot - mTop);
      ctx.strokeRect(cx, mTop, colW, mBot - mTop);
    }

    ctx.strokeStyle = 'rgba(255, 51, 85, 0.72)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(mX, mTop, innerW, mBot - mTop);

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.75)';
    ctx.setLineDash([4, 3]);
    for (const b of placedBoxes) {
      ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    }
    ctx.setLineDash([]);
  } else if (guideId === 'thirds') {
    ctx.strokeStyle = strokeSub;
    const x1 = width / 3;
    const x2 = (width * 2) / 3;
    const y1 = height / 3;
    const y2 = (height * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(x1, 0); ctx.lineTo(x1, height);
    ctx.moveTo(x2, 0); ctx.lineTo(x2, height);
    ctx.moveTo(0, y1); ctx.lineTo(width, y1);
    ctx.moveTo(0, y2); ctx.lineTo(width, y2);
    ctx.stroke();

    ctx.fillStyle = strokeMain;
    for (const px of [x1, x2]) {
      for (const py of [y1, y2]) {
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (guideId === 'phi-grid') {
    const phi = 0.6180339887;
    const inv = 1 - phi;
    const x1 = width * inv;
    const x2 = width * phi;
    const y1 = height * inv;
    const y2 = height * phi;

    ctx.strokeStyle = strokeMain;
    ctx.beginPath();
    ctx.moveTo(x1, 0); ctx.lineTo(x1, height);
    ctx.moveTo(x2, 0); ctx.lineTo(x2, height);
    ctx.moveTo(0, y1); ctx.lineTo(width, y1);
    ctx.moveTo(0, y2); ctx.lineTo(width, y2);
    ctx.stroke();

    ctx.fillStyle = strokeMain;
    for (const px of [x1, x2]) {
      for (const py of [y1, y2]) {
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (guideId === 'golden-spiral') {
    const phi = 1.6180339887;
    let rx = 0;
    let ry = 0;
    let rw = width;
    let rh = height;

    ctx.strokeStyle = strokeSub;
    ctx.lineWidth = 1;

    const arcs = [];
    for (let step = 0; step < 8; step++) {
      const dir = step % 4;
      if (dir === 0) {
        const subH = rh / phi;
        ctx.strokeRect(rx, ry, rw, subH);
        arcs.push({
          cx: rx + rw,
          cy: ry + subH,
          rX: rw,
          rY: subH,
          start: Math.PI,
          end: Math.PI * 1.5
        });
        ry += subH;
        rh -= subH;
      } else if (dir === 1) {
        const subW = rw / phi;
        const splitX = rx + rw - subW;
        ctx.strokeRect(splitX, ry, subW, rh);
        arcs.push({
          cx: splitX,
          cy: ry + rh,
          rX: subW,
          rY: rh,
          start: Math.PI * 1.5,
          end: Math.PI * 2
        });
        rw -= subW;
      } else if (dir === 2) {
        const subH = rh / phi;
        const splitY = ry + rh - subH;
        ctx.strokeRect(rx, splitY, rw, subH);
        arcs.push({
          cx: rx,
          cy: splitY,
          rX: rw,
          rY: subH,
          start: 0,
          end: Math.PI * 0.5
        });
        rh -= subH;
      } else {
        const subW = rw / phi;
        ctx.strokeRect(rx, ry, subW, rh);
        arcs.push({
          cx: rx + subW,
          cy: ry,
          rX: subW,
          rY: rh,
          start: Math.PI * 0.5,
          end: Math.PI
        });
        rx += subW;
        rw -= subW;
      }
    }

    ctx.strokeStyle = strokeMain;
    ctx.lineWidth = Math.max(1.8, width * 0.004);
    for (const a of arcs) {
      ctx.beginPath();
      ctx.ellipse(a.cx, a.cy, Math.max(1, a.rX), Math.max(1, a.rY), 0, a.start, a.end);
      ctx.stroke();
    }
    const last = arcs[arcs.length - 1];
    if (last) {
      ctx.fillStyle = strokeMain;
      ctx.beginPath();
      ctx.arc(last.cx, last.cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (guideId === 'diagonals') {
    ctx.strokeStyle = strokeSub;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(width, height);
    ctx.moveTo(width, 0); ctx.lineTo(0, height);
    ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
    ctx.stroke();

    ctx.strokeStyle = strokeMain;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.08, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStorySafeZones(ctx, width, height) {
  const topH = height * 0.11;
  const bottomH = height * 0.15;
  const fontPx = Math.max(10, Math.round(width * 0.026));

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, width, topH);
  ctx.fillRect(0, height - bottomH, width, bottomH);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(0, topH);
  ctx.lineTo(width, topH);
  ctx.moveTo(0, height - bottomH);
  ctx.lineTo(width, height - bottomH);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = `600 ${fontPx}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ZONA SICURA UI STORY (SUPERIORE)', width / 2, topH / 2);
  ctx.fillText('ZONA SICURA UI STORY (INFERIORE)', width / 2, height - bottomH / 2);
  ctx.restore();
}

function drawHorizonLine(ctx, width, height, angle, isLevel) {
  const cx = width / 2;
  const cy = height / 2;
  const rad = (angle * Math.PI) / 180;
  const radius = width * 0.28;
  const color = isLevel ? '#22C55E' : 'rgba(255, 255, 255, 0.78)';

  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-radius * 1.15, 0);
  ctx.lineTo(-radius * 0.85, 0);
  ctx.moveTo(radius * 0.85, 0);
  ctx.lineTo(radius * 1.15, 0);
  ctx.stroke();

  ctx.rotate(rad);
  ctx.strokeStyle = color;
  ctx.lineWidth = isLevel ? 2.5 : 1.75;
  ctx.beginPath();
  ctx.moveTo(-radius, 0);
  ctx.lineTo(radius, 0);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  const badgeFont = Math.max(10, Math.round(width * 0.025));
  ctx.font = `600 ${badgeFont}px "Space Grotesk", monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(`${angle > 0 ? '+' : ''}${angle.toFixed(1)}°`, cx, cy - radius * 0.22);
  ctx.restore();
}
