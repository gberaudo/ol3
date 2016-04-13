goog.module('ol.CollectionEvent');
goog.module.declareLegacyNamespace();

goog.require('ol.events.Event');
goog.require('ol.CollectionEventType');
goog.require('ol');


/**
 * @classdesc
 * Events emitted by {@link ol.Collection} instances are instances of this
 * type.
 *
 * @constructor
 * @extends {ol.events.Event}
 * @implements {oli.CollectionEvent}
 * @param {ol.CollectionEventType} type Type.
 * @param {*=} opt_element Element.
 * @param {Object=} opt_target Target.
 */
exports = function(type, opt_element, opt_target) {

  ol.events.Event.call(this, type, opt_target);

  /**
   * The element that is added to or removed from the collection.
   * @type {*}
   * @api stable
   */
  this.element = opt_element;

};
ol.inherits(exports, ol.events.Event);
