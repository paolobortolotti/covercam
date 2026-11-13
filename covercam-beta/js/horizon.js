import { logger } from './logger.js';

export class HorizonLevel {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.enabled = false;
    this.angle = 0;
    this.isLevel = true;
    this.boundHandler = this.handleOrientation.bind(this);
  }

  async enable() {
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      logger.warn('DeviceOrientationEvent non supportato dal dispositivo');
      return false;
    }

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        logger.info('Permesso sensore orientamento', { state });
        if (state !== 'granted') {
          return false;
        }
      } catch (err) {
        logger.error('Errore richiesta permesso DeviceOrientation', err);
        return false;
      }
    }

    window.addEventListener('deviceorientation', this.boundHandler, true);
    this.enabled = true;
    logger.info('Livella orizzonte attivata');
    return true;
  }

  disable() {
    window.removeEventListener('deviceorientation', this.boundHandler, true);
    this.enabled = false;
    logger.info('Livella orizzonte disattivata');
    if (this.onUpdate) {
      this.onUpdate({ enabled: false, angle: 0, isLevel: true });
    }
  }

  handleOrientation(event) {
    if (!this.enabled) return;

    const gamma = typeof event.gamma === 'number' ? event.gamma : 0;
    const beta = typeof event.beta === 'number' ? event.beta : 0;

    const screenAngle = (screen.orientation && typeof screen.orientation.angle === 'number')
      ? screen.orientation.angle
      : (typeof window.orientation === 'number' ? window.orientation : 0);

    let tilt = gamma;
    if (screenAngle === 90) {
      tilt = beta;
    } else if (screenAngle === -90 || screenAngle === 270) {
      tilt = -beta;
    }

    const clamped = Math.max(-45, Math.min(45, tilt));
    this.angle = this.angle * 0.7 + clamped * 0.3;
    this.isLevel = Math.abs(this.angle) <= 1.5;

    if (this.onUpdate) {
      this.onUpdate({
        enabled: true,
        angle: Number(this.angle.toFixed(1)),
        isLevel: this.isLevel
      });
    }
  }
}
