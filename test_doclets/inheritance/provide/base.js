goog.provide('ol.Base');


/**
 * @constructor
 * @api
 */
ol.Base = function() {

  /**
   * @type {Object}
   * @api stable
   */
  this.element = null;

};

/**
 * @api
 */
ol.Base.prototype.toOverride = function () {
}

/**
 * @api
 */
ol.Base.prototype.onlyBase = function () {
};
