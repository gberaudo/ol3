/**
 * @typedef {EventTarget|ol.events.EventTarget|
 *     {addEventListener: function(string, Function, boolean=),
 *     removeEventListener: function(string, Function, boolean=),
 *     dispatchEvent: function(string)}}
 */
ol.events.EventTargetLike;


/**
 * @typedef {{key_: string,
 *            newer: ol.structs.LRUCacheEntry,
 *            older: ol.structs.LRUCacheEntry,
 *            value_: *}}
 */
ol.structs.LRUCacheEntry;
