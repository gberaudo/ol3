goog.provide('ol.Child');

goog.require('ol.Base');
goog.require('ol');


/**
 * @extends {ol.Base}
 * @constructor
 * @api
 */
ol.Child = function() {

  ol.Base.call(this);

  /**
   * @type {Object}
   * @api stable
   */
  this.element = null;
};


ol.inherits(ol.Child, ol.Base);


/**
 * @inheritDoc
 */
ol.Child.toOverride = function() {
};
