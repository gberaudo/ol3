goog.module('ol.Base');
goog.module.declareLegacyNamespace();


/**
 * @constructor
 * @api
 */
var localName = function() {

  /**
   * @type {Object}
   * @api stable
   */
  this.element = null;

};

/**
 * @api
 */
localName.prototype.toOverride = function () {
}

/**
 * @api
 */
localName.prototype.onlyBase = function () {
};

exports = localName;
