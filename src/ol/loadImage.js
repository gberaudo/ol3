const waitingPromisesFunctions = {};
let counter = 0;


function loadImageWithinWorker(src, options) {
  return new Promise(function(resolve, reject) {
    const opaqueId = ++counter;
    self.postMessage({
      action: 'loadImage',
      opaqueId,
      src,
      options
    });
    waitingPromisesFunctions[opaqueId] = {
      ok(img) {
        resolve(img);
      },
      ko() {
        reject();
      },
      src
    };
  });
}

export function continueWorkerImageLoading(opaqueId, img) {
  const functions = waitingPromisesFunctions[opaqueId];
  delete waitingPromisesFunctions[opaqueId];
  if (img) {
    functions.ok(img);
  } {
    functions.ko(img);
  }
}

export function loadImageUsingDom(src, options) {
  return new Promise(function(resolve, reject) {
    const image = new Image();
    if (options.crossOrigin) {
      image.crossOrigin = options.crossOrigin;
    }
    image.src = src;
    image.onload = function() {
      if (options.size) {
        image.width = options.size[0];
        image.height = options.size[1];
      }
      resolve(image);
    };
    image.onerror = reject;
  });
}

export function loadImage(src, options) {
  if (typeof Image === 'undefined') {
    return loadImageWithinWorker(src, options);
  }

  return loadImageUsingDom(src, options);
}
