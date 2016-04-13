goog.module('ol.CollectionEventType');
goog.module.declareLegacyNamespace();


/**
 * @enum {string}
 */
exports = {
  /**
   * Triggered when an item is added to the collection.
   * @event ol.CollectionEvent#add
   * @api stable
   */
  ADD: 'add',
  /**
   * Triggered when an item is removed from the collection.
   * @event ol.CollectionEvent#remove
   * @api stable
   */
  REMOVE: 'remove'
};
