import {loadImageUsingDom} from '../src/ol/loadImage.js';

const waitingPromisesFunctions = {};
let counter = 0;


/**
 *
 * @param {string} src Source.
 * @param {Options} options Options.
 * @param {function((HTMLImageElement|ImageBitmap)): any} onSuccess Success .
 * @param {Function} onError Error callback.
 */
export function loadImageFromWithinWorker(src, options, onSuccess, onError) {
  const opaqueId = ++counter;
  waitingPromisesFunctions[opaqueId] = {
    ok: onSuccess,
    ko: onError,
    src
  };

  // In chrome, loading SVGs is not possible inside a worker,
  // so we ask the main thread for it.
  // For simplicity we use this mechanism for all images / all browsers.
  self.postMessage({
    action: 'loadImage',
    opaqueId,
    src,
    options
  });
}

export function registerMessageListenerForWorker() {
  addEventListener('message', function(event) {
    const action = event.data.action;
    if (action === 'continueWorkerImageLoading') {
      const {opaqueId, image} = event.data;
      const functions = waitingPromisesFunctions[opaqueId];
      delete waitingPromisesFunctions[opaqueId];
      image ? functions.ok(image) : functions.ko();
    }
  });
}

export function registerMessageListenerForMainThread(worker) {
  worker.addEventListener('message', function(event) {
    if (event.data.action != 'loadImage') {
      return;
    }
    const {src, options, opaqueId} = event.data;
    function onSuccess(domImage) {
      createImageBitmap(domImage).then(function(bmp) {
        worker.postMessage({
          action: 'continueWorkerImageLoading',
          opaqueId: opaqueId,
          image: bmp
        },
        [bmp]);
      });
    }
    function onError() {
      worker.postMessage({
        action: 'continueWorkerImageLoading',
        opaqueId: opaqueId,
        image: null
      });
    }
    loadImageUsingDom(src, options, onSuccess, onError);
  });
}


export default class {

  /**
   * @param {number} [width] Canvas width.
   * @param {number} [height] Canvas height.
   */
  constructor(width, height) {
    this.canvas_ = new OffscreenCanvas(width || 0, height || 0);
    this.width_ = width;
    this.height_ = height;
    this.previousListeners_ = {};
  }

  /**
   * @param {string} url The URL to load.
   */
  set src(url) {
    this.src_ = url;
    const onSuccess = function(bmp) {
      this.imageBitmap_ = bmp;
      this.drawImage_();
      this.canvas_.dispatchEvent(new CustomEvent('load'));
    }.bind(this);
    const onError = function() {
      this.canvas_.dispatchEvent(new CustomEvent('error'));
    }.bind(this);
    loadImageFromWithinWorker(url, {}, onSuccess, onError);
  }

  /**
   * @private
   */
  drawImage_() {
    /**
     * @type {CanvasRenderingContext2D}
     */
    const ctx = this.canvas_.getContext('2d');
    if (!this.height_) {
      this.height_ = this.canvas_.height = this.imageBitmap_.height;
    }
    if (!this.width_) {
      this.width_ = this.canvas_.width = this.imageBitmap_.width;
    }
    ctx.drawImage(this.imageBitmap_, 0, 0, this.width_, this.height_);
  }

  /**
   * @return {string} The loaded URL.
   */
  get src() {
    return this.src_;
  }

  /**
   * @param {number} width New width.
   */
  set width(width) {
    if (this.width_ !== width) {
      this.width_ = width;
      this.canvas_.width = width;
      this.drawImage_();
    }
  }

  /**
   * @param {number} height New height.
   */
  set height(height) {
    if (this.height !== height) {
      this.height_ = height;
      this.canvas_.height = height;
      this.drawImage_();
    }
  }

  set onload(fn) {
    this.changeListener_('load', fn);
  }

  set onerror(fn) {
    this.changeListener_('error', fn);
  }

  changeListener_(type, fn) {
    const previousFn = this.previousListeners_[type];
    if (previousFn) {
      this.canvas_.removeEventListener(type, previousFn);
    }
    this.previousListeners_[type] = fn;
    this.canvas_.addEventListener(type, fn);
  }
}
