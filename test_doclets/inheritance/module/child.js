goog.module('ol.Child');
goog.module.declareLegacyNamespace();

var Base = goog.require('ol.Base');
var ol = goog.require('ol');


/**
 * @extends {Base}
 * @constructor
 * @api
 */
exports = function() {

  Base.call(this);

  /**
   * @type {Object}
   * @api stable
   */
  this.element = null;
};


ol.inherits(exports, Base);


/**
 * @inheritDoc
 */
exports.toOverride = function() {
};
