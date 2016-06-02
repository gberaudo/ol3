goog.module('ol.Base');
goog.module.declareLegacyNamespace();


/**
 * @constructor
 * @api
 */
exports = function() {

  /**
   * @type {Object}
   * @api stable
   */
  this.element = null;

};

/**
 * @api
 */
exports.prototype.toOverride = function () {
}

/**
 * @api
 */
exports.prototype.onlyBase = function () {
};
