
export function createCanvas() {
  return typeof document !== 'undefined' ?
    /** @type {HTMLCanvasElement} */ (document.createElement('canvas')) :
    new OffscreenCanvas(150, 150);
}
