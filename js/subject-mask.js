import { logger } from './logger.js';

export class SubjectMaskController {
  constructor() {
    this.enabled = false;
    this.detector = null;
    this.detectorSupported = false;
    this.sampleCanvas = document.createElement('canvas');
    this.sampleCanvas.width = 96;
    this.sampleCanvas.height = 128;
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    this.maskZone = {
      x: 0.5,
      y: 0.24,
      rx: 0.22,
      ry: 0.19,
      autoDetected: false
    };
    this.initDetector();
  }

  initDetector() {
    if ('FaceDetector' in window) {
      try {
        this.detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        this.detectorSupported = true;
        logger.info('FaceDetector nativo disponibile per scontorno testata');
      } catch {
        this.detectorSupported = false;
      }
    }
  }

  setManualPoint(normX, normY) {
    this.maskZone.x = Math.max(0.15, Math.min(0.85, normX));
    this.maskZone.y = Math.max(0.10, Math.min(0.65, normY));
    this.maskZone.autoDetected = false;
    logger.info('Centro maschera volto impostato manualmente', {
      x: Number(this.maskZone.x.toFixed(2)),
      y: Number(this.maskZone.y.toFixed(2))
    });
  }

  async detectSubject(source, cropRect) {
    if (!this.enabled || !source || !cropRect || cropRect.sw <= 0 || cropRect.sh <= 0) {
      return this.maskZone;
    }

    if (this.detectorSupported && this.detector) {
      try {
        const faces = await this.detector.detect(source);
        if (faces && faces.length > 0) {
          const box = faces[0].boundingBox;
          const cx = (box.x + box.width / 2 - cropRect.sx) / cropRect.sw;
          const cy = (box.y + box.height / 2 - cropRect.sy) / cropRect.sh;
          const rx = Math.max(0.14, Math.min(0.36, (box.width / cropRect.sw) * 0.62));
          const ry = Math.max(0.14, Math.min(0.36, (box.height / cropRect.sh) * 0.68));
          this.maskZone = {
            x: cx,
            y: cy,
            rx,
            ry,
            autoDetected: true
          };
          return this.maskZone;
        }
      } catch {
        this.detectorSupported = false;
      }
    }

    try {
      const w = this.sampleCanvas.width;
      const h = this.sampleCanvas.height;
      this.sampleCtx.drawImage(
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

      const data = this.sampleCtx.getImageData(0, 0, w, h).data;
      let sumX = 0;
      let sumY = 0;
      let weightSum = 0;

      const yStart = Math.floor(h * 0.05);
      const yEnd = Math.floor(h * 0.48);
      const xStart = Math.floor(w * 0.2);
      const xEnd = Math.floor(w * 0.8);

      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const i = (y * w + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const isSkinTone = r > 85 && g > 40 && b > 25 && r > g && g > b * 0.85 && (r - Math.min(g, b)) > 18;
          if (isSkinTone) {
            const centerBias = 1 - Math.abs(x / w - 0.5) * 1.4;
            const wgt = Math.max(0.2, centerBias);
            sumX += (x / w) * wgt;
            sumY += (y / h) * wgt;
            weightSum += wgt;
          }
        }
      }

      if (weightSum > 28) {
        const targetX = sumX / weightSum;
        const targetY = sumY / weightSum;
        this.maskZone.x = this.maskZone.x * 0.65 + targetX * 0.35;
        this.maskZone.y = this.maskZone.y * 0.65 + targetY * 0.35;
        this.maskZone.autoDetected = true;
      }
    } catch {}

    return this.maskZone;
  }
}
