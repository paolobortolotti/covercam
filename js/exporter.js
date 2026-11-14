import { logger } from './logger.js';
import { FORMATS, resolveFilterCss, computeCropRect, renderCoverOverlay } from './renderer.js?v=30';

function formatTimestamp(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.95) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Conversione canvas in Blob fallita'));
    }, type, quality);
  });
}

export async function captureDualResolution({
  source,
  sourceWidth,
  sourceHeight,
  formatId,
  preset,
  renderOptions
}) {
  const format = FORMATS[formatId] || FORMATS.magazine;
  const crop = computeCropRect(sourceWidth, sourceHeight, format.ratio);

  logger.info('Avvio cattura ad alta risoluzione', {
    sourceWidth,
    sourceHeight,
    cropWidth: crop.sw,
    cropHeight: crop.sh,
    format: format.id,
    presetId: preset ? preset.id : null
  });

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const cleanCanvas = document.createElement('canvas');
  cleanCanvas.width = crop.sw;
  cleanCanvas.height = crop.sh;
  const cleanCtx = cleanCanvas.getContext('2d');
  const filterCss = resolveFilterCss(
    renderOptions && renderOptions.filterId,
    preset ? preset.genre : 'fashion',
    renderOptions && renderOptions.toneAdjust
  );
  if (filterCss !== 'none' && 'filter' in cleanCtx) {
    cleanCtx.filter = filterCss;
  }
  cleanCtx.drawImage(
    source,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    crop.sw,
    crop.sh
  );
  cleanCtx.filter = 'none';

  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = crop.sw;
  coverCanvas.height = crop.sh;
  const coverCtx = coverCanvas.getContext('2d');
  coverCtx.drawImage(cleanCanvas, 0, 0);

  renderCoverOverlay(coverCtx, crop.sw, crop.sh, preset, {
    ...renderOptions,
    formatId,
    isExport: true
  });

  const ts = formatTimestamp();
  const cleanFilename = `covercam_${ts}_clean.jpg`;
  const coverFilename = `covercam_${ts}_cover.jpg`;

  const [cleanBlob, coverBlob] = await Promise.all([
    canvasToBlob(cleanCanvas, 'image/jpeg', 0.95),
    canvasToBlob(coverCanvas, 'image/jpeg', 0.95)
  ]);

  logger.info('Cattura completata con successo', {
    cleanFilename,
    coverFilename,
    resolution: `${crop.sw}x${crop.sh}`,
    cleanBytes: cleanBlob.size,
    coverBytes: coverBlob.size
  });

  return {
    cleanBlob,
    coverBlob,
    cleanFilename,
    coverFilename,
    cleanUrl: URL.createObjectURL(cleanBlob),
    coverUrl: URL.createObjectURL(coverBlob),
    width: crop.sw,
    height: crop.sh
  };
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  logger.info('Download file avviato', { filename, size: blob.size });
}

export async function downloadBoth(captureResult) {
  triggerDownload(captureResult.cleanBlob, captureResult.cleanFilename);
  await new Promise(r => setTimeout(r, 280));
  triggerDownload(captureResult.coverBlob, captureResult.coverFilename);
}

export function canShareFiles() {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

export async function shareCapture(captureResult) {
  const cleanFile = new File([captureResult.cleanBlob], captureResult.cleanFilename, { type: 'image/jpeg' });
  const coverFile = new File([captureResult.coverBlob], captureResult.coverFilename, { type: 'image/jpeg' });

  const shareData = {
    title: 'CoverCam Scatto Editoriale',
    text: 'Scatto clean + copertina generati con CoverCam',
    files: [coverFile, cleanFile]
  };

  if (!canShareFiles() || !navigator.canShare({ files: shareData.files })) {
    throw new Error('Web Share API per file multipli non supportata su questo browser');
  }

  await navigator.share(shareData);
  logger.info('Condivisione Web Share completata', {
    files: [captureResult.coverFilename, captureResult.cleanFilename]
  });
}
