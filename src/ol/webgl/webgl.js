goog.module('ol.webgl');
goog.module.declareLegacyNamespace();


/**
 * @const
 * @private
 * @type {Array.<string>}
 */
var CONTEXT_IDS_ = [
  'experimental-webgl',
  'webgl',
  'webkit-3d',
  'moz-webgl'
];


/**
 * @enum {string}
 */
exports.WebGLContextEventType = {
  LOST: 'webglcontextlost',
  RESTORED: 'webglcontextrestored'
};


/**
 * @param {HTMLCanvasElement} canvas Canvas.
 * @param {Object=} opt_attributes Attributes.
 * @return {WebGLRenderingContext} WebGL rendering context.
 */
exports.getContext = function(canvas, opt_attributes) {
  var context, i, ii = CONTEXT_IDS_.length;
  for (i = 0; i < ii; ++i) {
    try {
      context = canvas.getContext(CONTEXT_IDS_[i], opt_attributes);
      if (context) {
        return /** @type {!WebGLRenderingContext} */ (context);
      }
    } catch (e) {
      // pass
    }
  }
  return null;
};
