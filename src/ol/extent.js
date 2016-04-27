/*eslint no-unused-vars: ["error", { "varsIgnorePattern": "Corner" }]*/

goog.module('ol.extent');
goog.module.declareLegacyNamespace();

goog.require('goog.asserts');
goog.require('goog.vec.Mat4');
goog.require('ol.Coordinate');
goog.require('ol.Size');
goog.require('ol.TransformFunction');


/**
 * Extent corner.
 * @enum {string}
 */
var Corner = {
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_RIGHT: 'bottom-right',
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right'
};

exports.Corner = Corner;

/**
 * Relationship to an extent.
 * @enum {number}
 * @api
 */
var Relationship = {
  UNKNOWN: 0,
  INTERSECTING: 1,
  ABOVE: 2,
  RIGHT: 4,
  BELOW: 8,
  LEFT: 16
};

exports.Relationship = Relationship;

/**
 * Build an extent that includes all given coordinates.
 *
 * @param {Array.<ol.Coordinate>} coordinates Coordinates.
 * @return {ol.Extent} Bounding extent.
 * @api stable
 */
exports.boundingExtent = function(coordinates) {
  var extent = exports.createEmpty();
  for (var i = 0, ii = coordinates.length; i < ii; ++i) {
    exports.extendCoordinate(extent, coordinates[i]);
  }
  return extent;
};


/**
 * @param {Array.<number>} xs Xs.
 * @param {Array.<number>} ys Ys.
 * @param {ol.Extent=} opt_extent Destination extent.
 * @private
 * @return {ol.Extent} Extent.
 */
exports.boundingExtentXYs_ = function(xs, ys, opt_extent) {
  goog.asserts.assert(xs.length > 0, 'xs length should be larger than 0');
  goog.asserts.assert(ys.length > 0, 'ys length should be larger than 0');
  var minX = Math.min.apply(null, xs);
  var minY = Math.min.apply(null, ys);
  var maxX = Math.max.apply(null, xs);
  var maxY = Math.max.apply(null, ys);
  return exports.createOrUpdate(minX, minY, maxX, maxY, opt_extent);
};


/**
 * Return extent increased by the provided value.
 * @param {ol.Extent} extent Extent.
 * @param {number} value The amount by which the extent should be buffered.
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} Extent.
 * @api stable
 */
exports.buffer = function(extent, value, opt_extent) {
  if (opt_extent) {
    opt_extent[0] = extent[0] - value;
    opt_extent[1] = extent[1] - value;
    opt_extent[2] = extent[2] + value;
    opt_extent[3] = extent[3] + value;
    return opt_extent;
  } else {
    return [
      extent[0] - value,
      extent[1] - value,
      extent[2] + value,
      extent[3] + value
    ];
  }
};


/**
 * Creates a clone of an extent.
 *
 * @param {ol.Extent} extent Extent to clone.
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} The clone.
 */
exports.clone = function(extent, opt_extent) {
  if (opt_extent) {
    opt_extent[0] = extent[0];
    opt_extent[1] = extent[1];
    opt_extent[2] = extent[2];
    opt_extent[3] = extent[3];
    return opt_extent;
  } else {
    return extent.slice();
  }
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {number} x X.
 * @param {number} y Y.
 * @return {number} Closest squared distance.
 */
exports.closestSquaredDistanceXY = function(extent, x, y) {
  var dx, dy;
  if (x < extent[0]) {
    dx = extent[0] - x;
  } else if (extent[2] < x) {
    dx = x - extent[2];
  } else {
    dx = 0;
  }
  if (y < extent[1]) {
    dy = extent[1] - y;
  } else if (extent[3] < y) {
    dy = y - extent[3];
  } else {
    dy = 0;
  }
  return dx * dx + dy * dy;
};


/**
 * Check if the passed coordinate is contained or on the edge of the extent.
 *
 * @param {ol.Extent} extent Extent.
 * @param {ol.Coordinate} coordinate Coordinate.
 * @return {boolean} The coordinate is contained in the extent.
 * @api stable
 */
exports.containsCoordinate = function(extent, coordinate) {
  return exports.containsXY(extent, coordinate[0], coordinate[1]);
};


/**
 * Check if one extent contains another.
 *
 * An extent is deemed contained if it lies completely within the other extent,
 * including if they share one or more edges.
 *
 * @param {ol.Extent} extent1 Extent 1.
 * @param {ol.Extent} extent2 Extent 2.
 * @return {boolean} The second extent is contained by or on the edge of the
 *     first.
 * @api stable
 */
exports.containsExtent = function(extent1, extent2) {
  return extent1[0] <= extent2[0] && extent2[2] <= extent1[2] &&
      extent1[1] <= extent2[1] && extent2[3] <= extent1[3];
};


/**
 * Check if the passed coordinate is contained or on the edge of the extent.
 *
 * @param {ol.Extent} extent Extent.
 * @param {number} x X coordinate.
 * @param {number} y Y coordinate.
 * @return {boolean} The x, y values are contained in the extent.
 * @api stable
 */
exports.containsXY = function(extent, x, y) {
  return extent[0] <= x && x <= extent[2] && extent[1] <= y && y <= extent[3];
};


/**
 * Get the relationship between a coordinate and extent.
 * @param {ol.Extent} extent The extent.
 * @param {ol.Coordinate} coordinate The coordinate.
 * @return {number} The relationship (bitwise compare with
 *     Relationship).
 */
exports.coordinateRelationship = function(extent, coordinate) {
  var minX = extent[0];
  var minY = extent[1];
  var maxX = extent[2];
  var maxY = extent[3];
  var x = coordinate[0];
  var y = coordinate[1];
  var relationship = Relationship.UNKNOWN;
  if (x < minX) {
    relationship = relationship | Relationship.LEFT;
  } else if (x > maxX) {
    relationship = relationship | Relationship.RIGHT;
  }
  if (y < minY) {
    relationship = relationship | Relationship.BELOW;
  } else if (y > maxY) {
    relationship = relationship | Relationship.ABOVE;
  }
  if (relationship === Relationship.UNKNOWN) {
    relationship = Relationship.INTERSECTING;
  }
  return relationship;
};


/**
 * Create an empty extent.
 * @return {ol.Extent} Empty extent.
 * @api stable
 */
exports.createEmpty = function() {
  return [Infinity, Infinity, -Infinity, -Infinity];
};


/**
 * Create a new extent or update the provided extent.
 * @param {number} minX Minimum X.
 * @param {number} minY Minimum Y.
 * @param {number} maxX Maximum X.
 * @param {number} maxY Maximum Y.
 * @param {ol.Extent=} opt_extent Destination extent.
 * @return {ol.Extent} Extent.
 */
exports.createOrUpdate = function(minX, minY, maxX, maxY, opt_extent) {
  if (opt_extent) {
    opt_extent[0] = minX;
    opt_extent[1] = minY;
    opt_extent[2] = maxX;
    opt_extent[3] = maxY;
    return opt_extent;
  } else {
    return [minX, minY, maxX, maxY];
  }
};


/**
 * Create a new empty extent or make the provided one empty.
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} Extent.
 */
exports.createOrUpdateEmpty = function(opt_extent) {
  return exports.createOrUpdate(
      Infinity, Infinity, -Infinity, -Infinity, opt_extent);
};


/**
 * @param {ol.Coordinate} coordinate Coordinate.
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} Extent.
 */
exports.createOrUpdateFromCoordinate = function(coordinate, opt_extent) {
  var x = coordinate[0];
  var y = coordinate[1];
  return exports.createOrUpdate(x, y, x, y, opt_extent);
};


/**
 * @param {Array.<ol.Coordinate>} coordinates Coordinates.
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} Extent.
 */
exports.createOrUpdateFromCoordinates = function(coordinates, opt_extent) {
  var extent = exports.createOrUpdateEmpty(opt_extent);
  return exports.extendCoordinates(extent, coordinates);
};


/**
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} Extent.
 */
exports.createOrUpdateFromFlatCoordinates = function(flatCoordinates, offset, end, stride, opt_extent) {
  var extent = exports.createOrUpdateEmpty(opt_extent);
  return exports.extendFlatCoordinates(
      extent, flatCoordinates, offset, end, stride);
};


/**
 * @param {Array.<Array.<ol.Coordinate>>} rings Rings.
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} Extent.
 */
exports.createOrUpdateFromRings = function(rings, opt_extent) {
  var extent = exports.createOrUpdateEmpty(opt_extent);
  return exports.extendRings(extent, rings);
};


/**
 * Empty an extent in place.
 * @param {ol.Extent} extent Extent.
 * @return {ol.Extent} Extent.
 */
exports.empty = function(extent) {
  extent[0] = extent[1] = Infinity;
  extent[2] = extent[3] = -Infinity;
  return extent;
};


/**
 * Determine if two extents are equivalent.
 * @param {ol.Extent} extent1 Extent 1.
 * @param {ol.Extent} extent2 Extent 2.
 * @return {boolean} The two extents are equivalent.
 * @api stable
 */
exports.equals = function(extent1, extent2) {
  return extent1[0] == extent2[0] && extent1[2] == extent2[2] &&
      extent1[1] == extent2[1] && extent1[3] == extent2[3];
};


/**
 * Modify an extent to include another extent.
 * @param {ol.Extent} extent1 The extent to be modified.
 * @param {ol.Extent} extent2 The extent that will be included in the first.
 * @return {ol.Extent} A reference to the first (extended) extent.
 * @api stable
 */
exports.extend = function(extent1, extent2) {
  if (extent2[0] < extent1[0]) {
    extent1[0] = extent2[0];
  }
  if (extent2[2] > extent1[2]) {
    extent1[2] = extent2[2];
  }
  if (extent2[1] < extent1[1]) {
    extent1[1] = extent2[1];
  }
  if (extent2[3] > extent1[3]) {
    extent1[3] = extent2[3];
  }
  return extent1;
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {ol.Coordinate} coordinate Coordinate.
 */
exports.extendCoordinate = function(extent, coordinate) {
  if (coordinate[0] < extent[0]) {
    extent[0] = coordinate[0];
  }
  if (coordinate[0] > extent[2]) {
    extent[2] = coordinate[0];
  }
  if (coordinate[1] < extent[1]) {
    extent[1] = coordinate[1];
  }
  if (coordinate[1] > extent[3]) {
    extent[3] = coordinate[1];
  }
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {Array.<ol.Coordinate>} coordinates Coordinates.
 * @return {ol.Extent} Extent.
 */
exports.extendCoordinates = function(extent, coordinates) {
  var i, ii;
  for (i = 0, ii = coordinates.length; i < ii; ++i) {
    exports.extendCoordinate(extent, coordinates[i]);
  }
  return extent;
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @return {ol.Extent} Extent.
 */
exports.extendFlatCoordinates = function(extent, flatCoordinates, offset, end, stride) {
  for (; offset < end; offset += stride) {
    exports.extendXY(
        extent, flatCoordinates[offset], flatCoordinates[offset + 1]);
  }
  return extent;
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {Array.<Array.<ol.Coordinate>>} rings Rings.
 * @return {ol.Extent} Extent.
 */
exports.extendRings = function(extent, rings) {
  var i, ii;
  for (i = 0, ii = rings.length; i < ii; ++i) {
    exports.extendCoordinates(extent, rings[i]);
  }
  return extent;
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {number} x X.
 * @param {number} y Y.
 */
exports.extendXY = function(extent, x, y) {
  extent[0] = Math.min(extent[0], x);
  extent[1] = Math.min(extent[1], y);
  extent[2] = Math.max(extent[2], x);
  extent[3] = Math.max(extent[3], y);
};


/**
 * This function calls `callback` for each corner of the extent. If the
 * callback returns a truthy value the function returns that value
 * immediately. Otherwise the function returns `false`.
 * @param {ol.Extent} extent Extent.
 * @param {function(this:T, ol.Coordinate): S} callback Callback.
 * @param {T=} opt_this Value to use as `this` when executing `callback`.
 * @return {S|boolean} Value.
 * @template S, T
 */
exports.forEachCorner = function(extent, callback, opt_this) {
  var val;
  val = callback.call(opt_this, exports.getBottomLeft(extent));
  if (val) {
    return val;
  }
  val = callback.call(opt_this, exports.getBottomRight(extent));
  if (val) {
    return val;
  }
  val = callback.call(opt_this, exports.getTopRight(extent));
  if (val) {
    return val;
  }
  val = callback.call(opt_this, exports.getTopLeft(extent));
  if (val) {
    return val;
  }
  return false;
};


/**
 * @param {ol.Extent} extent Extent.
 * @return {number} Area.
 */
exports.getArea = function(extent) {
  var area = 0;
  if (!exports.isEmpty(extent)) {
    area = exports.getWidth(extent) * exports.getHeight(extent);
  }
  return area;
};


/**
 * Get the bottom left coordinate of an extent.
 * @param {ol.Extent} extent Extent.
 * @return {ol.Coordinate} Bottom left coordinate.
 * @api stable
 */
exports.getBottomLeft = function(extent) {
  return [extent[0], extent[1]];
};


/**
 * Get the bottom right coordinate of an extent.
 * @param {ol.Extent} extent Extent.
 * @return {ol.Coordinate} Bottom right coordinate.
 * @api stable
 */
exports.getBottomRight = function(extent) {
  return [extent[2], extent[1]];
};


/**
 * Get the center coordinate of an extent.
 * @param {ol.Extent} extent Extent.
 * @return {ol.Coordinate} Center.
 * @api stable
 */
exports.getCenter = function(extent) {
  return [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
};


/**
 * Get a corner coordinate of an extent.
 * @param {ol.Extent} extent Extent.
 * @param {Corner} corner Corner.
 * @return {ol.Coordinate} Corner coordinate.
 */
exports.getCorner = function(extent, corner) {
  var coordinate;
  if (corner === exports.Corner.BOTTOM_LEFT) {
    coordinate = exports.getBottomLeft(extent);
  } else if (corner === exports.Corner.BOTTOM_RIGHT) {
    coordinate = exports.getBottomRight(extent);
  } else if (corner === exports.Corner.TOP_LEFT) {
    coordinate = exports.getTopLeft(extent);
  } else if (corner === exports.Corner.TOP_RIGHT) {
    coordinate = exports.getTopRight(extent);
  } else {
    goog.asserts.fail('Invalid corner: %s', corner);
  }
  goog.asserts.assert(coordinate, 'coordinate should be defined');
  return coordinate;
};


/**
 * @param {ol.Extent} extent1 Extent 1.
 * @param {ol.Extent} extent2 Extent 2.
 * @return {number} Enlarged area.
 */
exports.getEnlargedArea = function(extent1, extent2) {
  var minX = Math.min(extent1[0], extent2[0]);
  var minY = Math.min(extent1[1], extent2[1]);
  var maxX = Math.max(extent1[2], extent2[2]);
  var maxY = Math.max(extent1[3], extent2[3]);
  return (maxX - minX) * (maxY - minY);
};


/**
 * @param {ol.Coordinate} center Center.
 * @param {number} resolution Resolution.
 * @param {number} rotation Rotation.
 * @param {ol.Size} size Size.
 * @param {ol.Extent=} opt_extent Destination extent.
 * @return {ol.Extent} Extent.
 */
exports.getForViewAndSize = function(center, resolution, rotation, size, opt_extent) {
  var dx = resolution * size[0] / 2;
  var dy = resolution * size[1] / 2;
  var cosRotation = Math.cos(rotation);
  var sinRotation = Math.sin(rotation);
  var xCos = dx * cosRotation;
  var xSin = dx * sinRotation;
  var yCos = dy * cosRotation;
  var ySin = dy * sinRotation;
  var x = center[0];
  var y = center[1];
  var x0 = x - xCos + ySin;
  var x1 = x - xCos - ySin;
  var x2 = x + xCos - ySin;
  var x3 = x + xCos + ySin;
  var y0 = y - xSin - yCos;
  var y1 = y - xSin + yCos;
  var y2 = y + xSin + yCos;
  var y3 = y + xSin - yCos;
  return exports.createOrUpdate(
      Math.min(x0, x1, x2, x3), Math.min(y0, y1, y2, y3),
      Math.max(x0, x1, x2, x3), Math.max(y0, y1, y2, y3),
      opt_extent);
};


/**
 * Get the height of an extent.
 * @param {ol.Extent} extent Extent.
 * @return {number} Height.
 * @api stable
 */
exports.getHeight = function(extent) {
  return extent[3] - extent[1];
};


/**
 * @param {ol.Extent} extent1 Extent 1.
 * @param {ol.Extent} extent2 Extent 2.
 * @return {number} Intersection area.
 */
exports.getIntersectionArea = function(extent1, extent2) {
  var intersection = exports.getIntersection(extent1, extent2);
  return exports.getArea(intersection);
};


/**
 * Get the intersection of two extents.
 * @param {ol.Extent} extent1 Extent 1.
 * @param {ol.Extent} extent2 Extent 2.
 * @param {ol.Extent=} opt_extent Optional extent to populate with intersection.
 * @return {ol.Extent} Intersecting extent.
 * @api stable
 */
exports.getIntersection = function(extent1, extent2, opt_extent) {
  var intersection = opt_extent ? opt_extent : exports.createEmpty();
  if (exports.intersects(extent1, extent2)) {
    if (extent1[0] > extent2[0]) {
      intersection[0] = extent1[0];
    } else {
      intersection[0] = extent2[0];
    }
    if (extent1[1] > extent2[1]) {
      intersection[1] = extent1[1];
    } else {
      intersection[1] = extent2[1];
    }
    if (extent1[2] < extent2[2]) {
      intersection[2] = extent1[2];
    } else {
      intersection[2] = extent2[2];
    }
    if (extent1[3] < extent2[3]) {
      intersection[3] = extent1[3];
    } else {
      intersection[3] = extent2[3];
    }
  }
  return intersection;
};


/**
 * @param {ol.Extent} extent Extent.
 * @return {number} Margin.
 */
exports.getMargin = function(extent) {
  return exports.getWidth(extent) + exports.getHeight(extent);
};


/**
 * Get the size (width, height) of an extent.
 * @param {ol.Extent} extent The extent.
 * @return {ol.Size} The extent size.
 * @api stable
 */
exports.getSize = function(extent) {
  return [extent[2] - extent[0], extent[3] - extent[1]];
};


/**
 * Get the top left coordinate of an extent.
 * @param {ol.Extent} extent Extent.
 * @return {ol.Coordinate} Top left coordinate.
 * @api stable
 */
exports.getTopLeft = function(extent) {
  return [extent[0], extent[3]];
};


/**
 * Get the top right coordinate of an extent.
 * @param {ol.Extent} extent Extent.
 * @return {ol.Coordinate} Top right coordinate.
 * @api stable
 */
exports.getTopRight = function(extent) {
  return [extent[2], extent[3]];
};


/**
 * Get the width of an extent.
 * @param {ol.Extent} extent Extent.
 * @return {number} Width.
 * @api stable
 */
exports.getWidth = function(extent) {
  return extent[2] - extent[0];
};


/**
 * Determine if one extent intersects another.
 * @param {ol.Extent} extent1 Extent 1.
 * @param {ol.Extent} extent2 Extent.
 * @return {boolean} The two extents intersect.
 * @api stable
 */
exports.intersects = function(extent1, extent2) {
  return extent1[0] <= extent2[2] &&
      extent1[2] >= extent2[0] &&
      extent1[1] <= extent2[3] &&
      extent1[3] >= extent2[1];
};


/**
 * Determine if an extent is empty.
 * @param {ol.Extent} extent Extent.
 * @return {boolean} Is empty.
 * @api stable
 */
exports.isEmpty = function(extent) {
  return extent[2] < extent[0] || extent[3] < extent[1];
};


/**
 * @param {ol.Extent} extent Extent.
 * @return {boolean} Is infinite.
 */
exports.isInfinite = function(extent) {
  return extent[0] == -Infinity || extent[1] == -Infinity ||
      extent[2] == Infinity || extent[3] == Infinity;
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {ol.Coordinate} coordinate Coordinate.
 * @return {ol.Coordinate} Coordinate.
 */
exports.normalize = function(extent, coordinate) {
  return [
    (coordinate[0] - extent[0]) / (extent[2] - extent[0]),
    (coordinate[1] - extent[1]) / (extent[3] - extent[1])
  ];
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} Extent.
 */
exports.returnOrUpdate = function(extent, opt_extent) {
  if (opt_extent) {
    opt_extent[0] = extent[0];
    opt_extent[1] = extent[1];
    opt_extent[2] = extent[2];
    opt_extent[3] = extent[3];
    return opt_extent;
  } else {
    return extent;
  }
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {number} value Value.
 */
exports.scaleFromCenter = function(extent, value) {
  var deltaX = ((extent[2] - extent[0]) / 2) * (value - 1);
  var deltaY = ((extent[3] - extent[1]) / 2) * (value - 1);
  extent[0] -= deltaX;
  extent[2] += deltaX;
  extent[1] -= deltaY;
  extent[3] += deltaY;
};


/**
 * Determine if the segment between two coordinates intersects (crosses,
 * touches, or is contained by) the provided extent.
 * @param {ol.Extent} extent The extent.
 * @param {ol.Coordinate} start Segment start coordinate.
 * @param {ol.Coordinate} end Segment end coordinate.
 * @return {boolean} The segment intersects the extent.
 */
exports.intersectsSegment = function(extent, start, end) {
  var intersects = false;
  var startRel = exports.coordinateRelationship(extent, start);
  var endRel = exports.coordinateRelationship(extent, end);
  if (startRel === Relationship.INTERSECTING ||
      endRel === Relationship.INTERSECTING) {
    intersects = true;
  } else {
    var minX = extent[0];
    var minY = extent[1];
    var maxX = extent[2];
    var maxY = extent[3];
    var startX = start[0];
    var startY = start[1];
    var endX = end[0];
    var endY = end[1];
    var slope = (endY - startY) / (endX - startX);
    var x, y;
    if (!!(endRel & Relationship.ABOVE) &&
        !(startRel & Relationship.ABOVE)) {
      // potentially intersects top
      x = endX - ((endY - maxY) / slope);
      intersects = x >= minX && x <= maxX;
    }
    if (!intersects && !!(endRel & Relationship.RIGHT) &&
        !(startRel & Relationship.RIGHT)) {
      // potentially intersects right
      y = endY - ((endX - maxX) * slope);
      intersects = y >= minY && y <= maxY;
    }
    if (!intersects && !!(endRel & Relationship.BELOW) &&
        !(startRel & Relationship.BELOW)) {
      // potentially intersects bottom
      x = endX - ((endY - minY) / slope);
      intersects = x >= minX && x <= maxX;
    }
    if (!intersects && !!(endRel & Relationship.LEFT) &&
        !(startRel & Relationship.LEFT)) {
      // potentially intersects left
      y = endY - ((endX - minX) * slope);
      intersects = y >= minY && y <= maxY;
    }

  }
  return intersects;
};


/**
 * @param {ol.Extent} extent1 Extent 1.
 * @param {ol.Extent} extent2 Extent 2.
 * @return {boolean} Touches.
 */
exports.touches = function(extent1, extent2) {
  var intersects = exports.intersects(extent1, extent2);
  return intersects &&
      (extent1[0] == extent2[2] || extent1[2] == extent2[0] ||
       extent1[1] == extent2[3] || extent1[3] == extent2[1]);
};


/**
 * Apply a transform function to the extent.
 * @param {ol.Extent} extent Extent.
 * @param {ol.TransformFunction} transformFn Transform function.  Called with
 * [minX, minY, maxX, maxY] extent coordinates.
 * @param {ol.Extent=} opt_extent Destination extent.
 * @return {ol.Extent} Extent.
 * @api stable
 */
exports.applyTransform = function(extent, transformFn, opt_extent) {
  var coordinates = [
    extent[0], extent[1],
    extent[0], extent[3],
    extent[2], extent[1],
    extent[2], extent[3]
  ];
  transformFn(coordinates, coordinates, 2);
  var xs = [coordinates[0], coordinates[2], coordinates[4], coordinates[6]];
  var ys = [coordinates[1], coordinates[3], coordinates[5], coordinates[7]];
  return exports.boundingExtentXYs_(xs, ys, opt_extent);
};


/**
 * Apply a 2d transform to an extent.
 * @param {ol.Extent} extent Input extent.
 * @param {goog.vec.Mat4.Number} transform The transform matrix.
 * @param {ol.Extent=} opt_extent Optional extent for return values.
 * @return {ol.Extent} The transformed extent.
 */
exports.transform2D = function(extent, transform, opt_extent) {
  var dest = opt_extent ? opt_extent : [];
  var m00 = goog.vec.Mat4.getElement(transform, 0, 0);
  var m10 = goog.vec.Mat4.getElement(transform, 1, 0);
  var m01 = goog.vec.Mat4.getElement(transform, 0, 1);
  var m11 = goog.vec.Mat4.getElement(transform, 1, 1);
  var m03 = goog.vec.Mat4.getElement(transform, 0, 3);
  var m13 = goog.vec.Mat4.getElement(transform, 1, 3);
  var xi = [0, 2, 0, 2];
  var yi = [1, 1, 3, 3];
  var xs = [];
  var ys = [];
  var i, x, y;
  for (i = 0; i < 4; ++i) {
    x = extent[xi[i]];
    y = extent[yi[i]];
    xs[i] = m00 * x + m01 * y + m03;
    ys[i] = m10 * x + m11 * y + m13;
  }
  dest[0] = Math.min.apply(null, xs);
  dest[1] = Math.min.apply(null, ys);
  dest[2] = Math.max.apply(null, xs);
  dest[3] = Math.max.apply(null, ys);
  return dest;
};
