/**
 * @typedef {{attributions: (ol.AttributionLike|undefined),
 *            logo: (string|olx.LogoOptions|undefined),
 *            projection: ol.proj.ProjectionLike,
 *            state: (ol.source.State|undefined),
 *            wrapX: (boolean|undefined)}}
 * @api
 */
ol.source.SourceOptions;


/**
 * @typedef {{attributions: (ol.AttributionLike|undefined),
 *            extent: (null|ol.Extent|undefined),
 *            logo: (string|olx.LogoOptions|undefined),
 *            projection: ol.proj.ProjectionLike,
 *            resolutions: (Array.<number>|undefined),
 *            state: (ol.source.State|undefined)}}
 * @api
 */
ol.source.ImageOptions;


/**
 * A color represented as a short array [red, green, blue, alpha].
 * red, green, and blue should be integers in the range 0..255 inclusive.
 * alpha should be a float in the range 0..1 inclusive. If no alpha value is
 * given then `1` will be used.
 * @typedef {Array.<number>}
 * @api
 */
ol.Color;
