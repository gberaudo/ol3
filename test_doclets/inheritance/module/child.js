goog.module('ol.Child');
goog.module.declareLegacyNamespace();

var Base = goog.require('ol.Base');
var ol = goog.require('ol');


/**
 * @extends {Base}
 * @constructor
 * @api
 */
var someLocalName = function() {

  Base.call(this);

  /**
   * @type {Object}
   * @api stable
   */
  this.element = null;
};


ol.inherits(someLocalName, Base);


/**
 * @inheritDoc
 */
someLocalName.toOverride = function() {
};

exports = someLocalName;
