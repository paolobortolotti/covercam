import { logger } from './logger.js';

export class CameraController {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.facingMode = 'environment';
    this.activeResolution = { width: 0, height: 0 };
  }

  async start(facingMode = this.facingMode) {
    this.stop();
    this.facingMode = facingMode;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('API getUserMedia non supportata in questo browser o contesto non HTTPS.');
      logger.error('Fotocamera non disponibile', err);
      throw err;
    }

    const constraintsList = [
      {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 4096 },
          height: { ideal: 3072 }
        }
      },
      {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      },
      {
        audio: false,
        video: true
      }
    ];

    let lastError = null;
    for (const constraints of constraintsList) {
      try {
        logger.info('Richiesta accesso fotocamera', constraints.video);
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
        logger.warn('Tentativo vincoli fotocamera fallito, provo fallback', {
          name: err.name,
          message: err.message
        });
      }
    }

    if (!this.stream) {
      logger.error('Impossibile avviare lo stream fotocamera', lastError);
      throw lastError || new Error('Accesso alla fotocamera negato');
    }

    this.video.srcObject = this.stream;
    await new Promise((resolve) => {
      const onLoaded = () => {
        this.video.removeEventListener('loadedmetadata', onLoaded);
        resolve();
      };
      if (this.video.readyState >= 1) {
        resolve();
      } else {
        this.video.addEventListener('loadedmetadata', onLoaded);
      }
    });

    await this.video.play();

    const track = this.stream.getVideoTracks()[0];
    const settings = track ? track.getSettings() : {};
    this.activeResolution = {
      width: this.video.videoWidth || settings.width || 0,
      height: this.video.videoHeight || settings.height || 0
    };

    logger.info('Fotocamera inizializzata', {
      width: this.activeResolution.width,
      height: this.activeResolution.height,
      facingMode: settings.facingMode || facingMode,
      label: track ? track.label : 'unknown'
    });

    return this.activeResolution;
  }

  async toggleFacingMode() {
    const next = this.facingMode === 'environment' ? 'user' : 'environment';
    return this.start(next);
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
      logger.debug('Stream fotocamera fermato');
    }
  }
}
