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
      y: 0.22,
      rx: 0.24,
      ry: 0.20,
      feather: 0.72,
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
    this.maskZone.x = Math.max(0.10, Math.min(0.90, normX));
    this.maskZone.y = Math.max(0.06, Math.min(0.70, normY));
    this.maskZone.autoDetected = false;
    logger.info('Centro scontorno volto spostato manualmente', {
      x: Number(this.maskZone.x.toFixed(2)),
      y: Number(this.maskZone.y.toFixed(2))
    });
  }

  setSize(scaleFactor) {
    const s = Math.max(0.10, Math.min(0.55, scaleFactor));
    this.maskZone.rx = s;
    this.maskZone.ry = s * 0.86;
  }

  setFeather(featherVal) {
    this.maskZone.feather = Math.max(0.15, Math.min(0.95, featherVal));
  }

  async detectSubject(source, cropRect) {
    if (!this.enabled || !source || !cropRect || cropRect.sw <= 0 || cropRect.sh <= 0) {
      return this.maskZone;
    }

    if (!this.maskZone.autoDetected) {
      return this.maskZone;
    }

    if (this.detectorSupported && this.detector) {
      try {
        const faces = await this.detector.detect(source);
        if (faces && faces.length > 0) {
          const box = faces[0].boundingBox;
          const cx = (box.x + box.width / 2 - cropRect.sx) / cropRect.sw;
          const cy = (box.y + box.height / 2 - cropRect.sy) / cropRect.sh;
          this.maskZone.x = Math.max(0.1, Math.min(0.9, cx));
          this.maskZone.y = Math.max(0.06, Math.min(0.65, cy));
          return this.maskZone;
        }
      } catch {
        this.detectorSupported = false;
      }
    }

    return this.maskZone;
  }
}
