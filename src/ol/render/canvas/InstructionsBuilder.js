/**
 * @module ol/render/canvas/InstructionsBuilder
 */
import {equals, reverseSubArray} from '../../array.js';
import {asColorLike} from '../../colorlike.js';
import {buffer, clone, coordinateRelationship,
  createOrUpdateEmpty} from '../../extent.js';
import Relationship from '../../extent/Relationship.js';
import GeometryType from '../../geom/GeometryType.js';
import {inflateCoordinates, inflateCoordinatesArray, inflateMultiCoordinatesArray} from '../../geom/flat/inflate.js';
import {CANVAS_LINE_DASH} from '../../has.js';
import VectorContext from '../VectorContext.js';
import {drawImage, resetTransform, defaultFillStyle, defaultStrokeStyle,
  defaultMiterLimit, defaultLineWidth, defaultLineJoin, defaultLineDashOffset,
  defaultLineDash, defaultLineCap} from '../canvas.js';
import CanvasInstruction from './Instruction.js';
import {
  create as createTransform,
  apply as applyTransform
} from '../../transform.js';


/**
 * @typedef {Object} SerializableInstructions
 * @property {Array<*>} instructions The rendering instructions.
 * @property {Array<*>} hitDetectionInstructions The rendering hit detection instructions.
 * @property {Array<number>} coordinates The array of all coordinates.
 * @property {!Object<string, import("../canvas.js").TextState>} [textStates] The text states (decluttering).
 * @property {!Object<string, import("../canvas.js").FillState>} [fillStates] The fill states (decluttering).
 * @property {!Object<string, import("../canvas.js").StrokeState>} [strokeStates] The stoke states (decluttering).
 */


class CanvasInstructionsBuilder extends VectorContext {
  /**
   * @param {number} tolerance Tolerance.
   * @param {import("../../extent.js").Extent} maxExtent Maximum extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {boolean} overlaps The replay can have overlapping geometries.
   * @param {?} declutterTree Declutter tree.
   */
  constructor(tolerance, maxExtent, resolution, pixelRatio, overlaps, declutterTree) {
    super();

    /**
     * @type {?}
     */
    this.declutterTree = declutterTree;

    /**
     * @protected
     * @type {number}
     */
    this.tolerance = tolerance;

    /**
     * @protected
     * @const
     * @type {import("../../extent.js").Extent}
     */
    this.maxExtent = maxExtent;

    /**
     * @protected
     * @type {boolean}
     */
    this.overlaps = overlaps;

    /**
     * @protected
     * @type {number}
     */
    this.pixelRatio = pixelRatio;

    /**
     * @protected
     * @type {number}
     */
    this.maxLineWidth = 0;

    /**
     * @protected
     * @const
     * @type {number}
     */
    this.resolution = resolution;

    /**
     * @private
     * @type {boolean}
     */
    this.alignFill_;

    /**
     * @private
     * @type {Array<*>}
     */
    this.beginGeometryInstruction1_ = null;

    /**
     * @private
     * @type {Array<*>}
     */
    this.beginGeometryInstruction2_ = null;

    /**
     * @private
     * @type {import("../../extent.js").Extent}
     */
    this.bufferedMaxExtent_ = null;

    /**
     * @protected
     * @type {Array<*>}
     */
    this.instructions = [];

    /**
     * @protected
     * @type {Array<number>}
     */
    this.coordinates = [];

    /**
     * @private
     * @type {!Object<number,import("../../coordinate.js").Coordinate|Array<import("../../coordinate.js").Coordinate>|Array<Array<import("../../coordinate.js").Coordinate>>>}
     */
    this.coordinateCache_ = {};

    /**
     * @private
     * @type {!import("../../transform.js").Transform}
     */
    this.renderedTransform_ = createTransform();

    /**
     * @protected
     * @type {Array<*>}
     */
    this.hitDetectionInstructions = [];

    /**
     * @private
     * @type {Array<number>}
     */
    this.pixelCoordinates_ = null;

    /**
     * @protected
     * @type {import("../canvas.js").FillStrokeState}
     */
    this.state = /** @type {import("../canvas.js").FillStrokeState} */ ({});

    /**
     * @private
     * @type {number}
     */
    this.viewRotation_ = 0;

  }

  /**
   * @protected
   * @param {Array<number>} dashArray Dash array.
   * @return {Array<number>} Dash array with pixel ratio applied
   */
  applyPixelRatio(dashArray) {
    const pixelRatio = this.pixelRatio;
    return pixelRatio == 1 ? dashArray : dashArray.map(function(dash) {
      return dash * pixelRatio;
    });
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {number} end End.
   * @param {number} stride Stride.
   * @param {boolean} closed Last input coordinate equals first.
   * @param {boolean} skipFirst Skip first coordinate.
   * @protected
   * @return {number} My end.
   */
  appendFlatCoordinates(flatCoordinates, offset, end, stride, closed, skipFirst) {

    let myEnd = this.coordinates.length;
    const extent = this.getBufferedMaxExtent();
    if (skipFirst) {
      offset += stride;
    }
    const lastCoord = [flatCoordinates[offset], flatCoordinates[offset + 1]];
    const nextCoord = [NaN, NaN];
    let skipped = true;

    let i, lastRel, nextRel;
    for (i = offset + stride; i < end; i += stride) {
      nextCoord[0] = flatCoordinates[i];
      nextCoord[1] = flatCoordinates[i + 1];
      nextRel = coordinateRelationship(extent, nextCoord);
      if (nextRel !== lastRel) {
        if (skipped) {
          this.coordinates[myEnd++] = lastCoord[0];
          this.coordinates[myEnd++] = lastCoord[1];
        }
        this.coordinates[myEnd++] = nextCoord[0];
        this.coordinates[myEnd++] = nextCoord[1];
        skipped = false;
      } else if (nextRel === Relationship.INTERSECTING) {
        this.coordinates[myEnd++] = nextCoord[0];
        this.coordinates[myEnd++] = nextCoord[1];
        skipped = false;
      } else {
        skipped = true;
      }
      lastCoord[0] = nextCoord[0];
      lastCoord[1] = nextCoord[1];
      lastRel = nextRel;
    }

    // Last coordinate equals first or only one point to append:
    if ((closed && skipped) || i === offset + stride) {
      this.coordinates[myEnd++] = lastCoord[0];
      this.coordinates[myEnd++] = lastCoord[1];
    }
    return myEnd;
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {Array<number>} ends Ends.
   * @param {number} stride Stride.
   * @param {Array<number>} replayEnds Replay ends.
   * @return {number} Offset.
   */
  drawCustomCoordinates_(flatCoordinates, offset, ends, stride, replayEnds) {
    for (let i = 0, ii = ends.length; i < ii; ++i) {
      const end = ends[i];
      const replayEnd = this.appendFlatCoordinates(flatCoordinates, offset, end, stride, false, false);
      replayEnds.push(replayEnd);
      offset = end;
    }
    return offset;
  }

  /**
   * @inheritDoc.
   */
  drawCustom(geometry, feature, renderer) {
    this.beginGeometry(geometry, feature);
    const type = geometry.getType();
    const stride = geometry.getStride();
    const replayBegin = this.coordinates.length;
    let flatCoordinates, replayEnd, replayEnds, replayEndss;
    let offset;
    if (type == GeometryType.MULTI_POLYGON) {
      geometry = /** @type {import("../../geom/MultiPolygon.js").default} */ (geometry);
      flatCoordinates = geometry.getOrientedFlatCoordinates();
      replayEndss = [];
      const endss = geometry.getEndss();
      offset = 0;
      for (let i = 0, ii = endss.length; i < ii; ++i) {
        const myEnds = [];
        offset = this.drawCustomCoordinates_(flatCoordinates, offset, endss[i], stride, myEnds);
        replayEndss.push(myEnds);
      }
      this.instructions.push([CanvasInstruction.CUSTOM,
        replayBegin, replayEndss, geometry, renderer, inflateMultiCoordinatesArray]);
    } else if (type == GeometryType.POLYGON || type == GeometryType.MULTI_LINE_STRING) {
      replayEnds = [];
      flatCoordinates = (type == GeometryType.POLYGON) ?
        /** @type {import("../../geom/Polygon.js").default} */ (geometry).getOrientedFlatCoordinates() :
        geometry.getFlatCoordinates();
      offset = this.drawCustomCoordinates_(flatCoordinates, 0,
        /** @type {import("../../geom/Polygon.js").default|import("../../geom/MultiLineString.js").default} */ (geometry).getEnds(),
        stride, replayEnds);
      this.instructions.push([CanvasInstruction.CUSTOM,
        replayBegin, replayEnds, geometry, renderer, inflateCoordinatesArray]);
    } else if (type == GeometryType.LINE_STRING || type == GeometryType.MULTI_POINT) {
      flatCoordinates = geometry.getFlatCoordinates();
      replayEnd = this.appendFlatCoordinates(
        flatCoordinates, 0, flatCoordinates.length, stride, false, false);
      this.instructions.push([CanvasInstruction.CUSTOM,
        replayBegin, replayEnd, geometry, renderer, inflateCoordinates]);
    } else if (type == GeometryType.POINT) {
      flatCoordinates = geometry.getFlatCoordinates();
      this.coordinates.push(flatCoordinates[0], flatCoordinates[1]);
      replayEnd = this.coordinates.length;
      this.instructions.push([CanvasInstruction.CUSTOM,
        replayBegin, replayEnd, geometry, renderer]);
    }
    this.endGeometry(geometry, feature);
  }

  /**
   * @protected
   * @param {import("../../geom/Geometry.js").default|import("../Feature.js").default} geometry Geometry.
   * @param {import("../../Feature.js").default|import("../Feature.js").default} feature Feature.
   */
  beginGeometry(geometry, feature) {
    this.beginGeometryInstruction1_ = [CanvasInstruction.BEGIN_GEOMETRY, feature, 0];
    this.instructions.push(this.beginGeometryInstruction1_);
    this.beginGeometryInstruction2_ = [CanvasInstruction.BEGIN_GEOMETRY, feature, 0];
    this.hitDetectionInstructions.push(this.beginGeometryInstruction2_);
  }

  /**
   * @return {SerializableInstructions} the serializable instructions.
   */
  finish() {
    return {
      instructions: this.instructions,
      hitDetectionInstructions: this.hitDetectionInstructions,
      coordinates: this.coordinates
    };
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} context Context.
   */
  fill_(context) {
    if (this.alignFill_) {
      const origin = applyTransform(this.renderedTransform_, [0, 0]);
      const repeatSize = 512 * this.pixelRatio;
      context.translate(origin[0] % repeatSize, origin[1] % repeatSize);
      context.rotate(this.viewRotation_);
    }
    context.fill();
    if (this.alignFill_) {
      context.setTransform.apply(context, resetTransform);
    }
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} context Context.
   * @param {Array<*>} instruction Instruction.
   */
  setStrokeStyle_(context, instruction) {
    context.strokeStyle = /** @type {import("../../colorlike.js").ColorLike} */ (instruction[1]);
    context.lineWidth = /** @type {number} */ (instruction[2]);
    context.lineCap = /** @type {CanvasLineCap} */ (instruction[3]);
    context.lineJoin = /** @type {CanvasLineJoin} */ (instruction[4]);
    context.miterLimit = /** @type {number} */ (instruction[5]);
    if (CANVAS_LINE_DASH) {
      context.lineDashOffset = /** @type {number} */ (instruction[7]);
      context.setLineDash(/** @type {Array<number>} */ (instruction[6]));
    }
  }

  /**
   * @param {import("../canvas.js").DeclutterGroup} declutterGroup Declutter group.
   * @param {import("../../Feature.js").default|import("../Feature.js").default} feature Feature.
   */
  renderDeclutter_(declutterGroup, feature) {
    if (declutterGroup && declutterGroup.length > 5) {
      const groupCount = declutterGroup[4];
      if (groupCount == 1 || groupCount == declutterGroup.length - 5) {
        /** @type {import("../../structs/RBush.js").Entry} */
        const box = {
          minX: /** @type {number} */ (declutterGroup[0]),
          minY: /** @type {number} */ (declutterGroup[1]),
          maxX: /** @type {number} */ (declutterGroup[2]),
          maxY: /** @type {number} */ (declutterGroup[3]),
          value: feature
        };
        if (!this.declutterTree.collides(box)) {
          this.declutterTree.insert(box);
          for (let j = 5, jj = declutterGroup.length; j < jj; ++j) {
            const declutterData = /** @type {Array} */ (declutterGroup[j]);
            if (declutterData) {
              if (declutterData.length > 11) {
                this.replayTextBackground_(declutterData[0],
                  declutterData[13], declutterData[14], declutterData[15], declutterData[16],
                  declutterData[11], declutterData[12]);
              }
              drawImage.apply(undefined, declutterData);
            }
          }
        }
        declutterGroup.length = 5;
        createOrUpdateEmpty(declutterGroup);
      }
    }
  }

  /**
   * Reverse the hit detection instructions.
   */
  reverseHitDetectionInstructions() {
    const hitDetectionInstructions = this.hitDetectionInstructions;
    // step 1 - reverse array
    hitDetectionInstructions.reverse();
    // step 2 - reverse instructions within geometry blocks
    let i;
    const n = hitDetectionInstructions.length;
    let instruction;
    let type;
    let begin = -1;
    for (i = 0; i < n; ++i) {
      instruction = hitDetectionInstructions[i];
      type = /** @type {CanvasInstruction} */ (instruction[0]);
      if (type == CanvasInstruction.END_GEOMETRY) {
        begin = i;
      } else if (type == CanvasInstruction.BEGIN_GEOMETRY) {
        instruction[2] = i;
        reverseSubArray(this.hitDetectionInstructions, begin, i);
        begin = -1;
      }
    }
  }

  /**
   * @inheritDoc
   */
  setFillStrokeStyle(fillStyle, strokeStyle) {
    const state = this.state;
    if (fillStyle) {
      const fillStyleColor = fillStyle.getColor();
      state.fillStyle = asColorLike(fillStyleColor ?
        fillStyleColor : defaultFillStyle);
    } else {
      state.fillStyle = undefined;
    }
    if (strokeStyle) {
      const strokeStyleColor = strokeStyle.getColor();
      state.strokeStyle = asColorLike(strokeStyleColor ?
        strokeStyleColor : defaultStrokeStyle);
      const strokeStyleLineCap = strokeStyle.getLineCap();
      state.lineCap = strokeStyleLineCap !== undefined ?
        strokeStyleLineCap : defaultLineCap;
      const strokeStyleLineDash = strokeStyle.getLineDash();
      state.lineDash = strokeStyleLineDash ?
        strokeStyleLineDash.slice() : defaultLineDash;
      const strokeStyleLineDashOffset = strokeStyle.getLineDashOffset();
      state.lineDashOffset = strokeStyleLineDashOffset ?
        strokeStyleLineDashOffset : defaultLineDashOffset;
      const strokeStyleLineJoin = strokeStyle.getLineJoin();
      state.lineJoin = strokeStyleLineJoin !== undefined ?
        strokeStyleLineJoin : defaultLineJoin;
      const strokeStyleWidth = strokeStyle.getWidth();
      state.lineWidth = strokeStyleWidth !== undefined ?
        strokeStyleWidth : defaultLineWidth;
      const strokeStyleMiterLimit = strokeStyle.getMiterLimit();
      state.miterLimit = strokeStyleMiterLimit !== undefined ?
        strokeStyleMiterLimit : defaultMiterLimit;

      if (state.lineWidth > this.maxLineWidth) {
        this.maxLineWidth = state.lineWidth;
        // invalidate the buffered max extent cache
        this.bufferedMaxExtent_ = null;
      }
    } else {
      state.strokeStyle = undefined;
      state.lineCap = undefined;
      state.lineDash = null;
      state.lineDashOffset = undefined;
      state.lineJoin = undefined;
      state.lineWidth = undefined;
      state.miterLimit = undefined;
    }
  }

  /**
   * @param {import("../canvas.js").FillStrokeState} state State.
   * @param {import("../../geom/Geometry.js").default|import("../Feature.js").default} geometry Geometry.
   * @return {Array<*>} Fill instruction.
   */
  createFill(state, geometry) {
    const fillStyle = state.fillStyle;
    /** @type {Array<*>} */
    const fillInstruction = [CanvasInstruction.SET_FILL_STYLE, fillStyle];
    if (typeof fillStyle !== 'string') {
      // Fill is a pattern or gradient - align it!
      fillInstruction.push(true);
    }
    return fillInstruction;
  }

  /**
   * @param {import("../canvas.js").FillStrokeState} state State.
   */
  applyStroke(state) {
    this.instructions.push(this.createStroke(state));
  }

  /**
   * @param {import("../canvas.js").FillStrokeState} state State.
   * @return {Array<*>} Stroke instruction.
   */
  createStroke(state) {
    return [
      CanvasInstruction.SET_STROKE_STYLE,
      state.strokeStyle, state.lineWidth * this.pixelRatio, state.lineCap,
      state.lineJoin, state.miterLimit,
      this.applyPixelRatio(state.lineDash), state.lineDashOffset * this.pixelRatio
    ];
  }

  /**
   * @param {import("../canvas.js").FillStrokeState} state State.
   * @param {function(this:CanvasInstructionsBuilder, import("../canvas.js").FillStrokeState, (import("../../geom/Geometry.js").default|import("../Feature.js").default)):Array<*>} createFill Create fill.
   * @param {import("../../geom/Geometry.js").default|import("../Feature.js").default} geometry Geometry.
   */
  updateFillStyle(state, createFill, geometry) {
    const fillStyle = state.fillStyle;
    if (typeof fillStyle !== 'string' || state.currentFillStyle != fillStyle) {
      if (fillStyle !== undefined) {
        this.instructions.push(createFill.call(this, state, geometry));
      }
      state.currentFillStyle = fillStyle;
    }
  }

  /**
   * @param {import("../canvas.js").FillStrokeState} state State.
   * @param {function(this:CanvasInstructionsBuilder, import("../canvas.js").FillStrokeState)} applyStroke Apply stroke.
   */
  updateStrokeStyle(state, applyStroke) {
    const strokeStyle = state.strokeStyle;
    const lineCap = state.lineCap;
    const lineDash = state.lineDash;
    const lineDashOffset = state.lineDashOffset;
    const lineJoin = state.lineJoin;
    const lineWidth = state.lineWidth;
    const miterLimit = state.miterLimit;
    if (state.currentStrokeStyle != strokeStyle ||
        state.currentLineCap != lineCap ||
        (lineDash != state.currentLineDash && !equals(state.currentLineDash, lineDash)) ||
        state.currentLineDashOffset != lineDashOffset ||
        state.currentLineJoin != lineJoin ||
        state.currentLineWidth != lineWidth ||
        state.currentMiterLimit != miterLimit) {
      if (strokeStyle !== undefined) {
        applyStroke.call(this, state);
      }
      state.currentStrokeStyle = strokeStyle;
      state.currentLineCap = lineCap;
      state.currentLineDash = lineDash;
      state.currentLineDashOffset = lineDashOffset;
      state.currentLineJoin = lineJoin;
      state.currentLineWidth = lineWidth;
      state.currentMiterLimit = miterLimit;
    }
  }

  /**
   * @param {import("../../geom/Geometry.js").default|import("../Feature.js").default} geometry Geometry.
   * @param {import("../../Feature.js").default|import("../Feature.js").default} feature Feature.
   */
  endGeometry(geometry, feature) {
    this.beginGeometryInstruction1_[2] = this.instructions.length;
    this.beginGeometryInstruction1_ = null;
    this.beginGeometryInstruction2_[2] = this.hitDetectionInstructions.length;
    this.beginGeometryInstruction2_ = null;
    const endGeometryInstruction = [CanvasInstruction.END_GEOMETRY, feature];
    this.instructions.push(endGeometryInstruction);
    this.hitDetectionInstructions.push(endGeometryInstruction);
  }

  /**
   * Get the buffered rendering extent.  Rendering will be clipped to the extent
   * provided to the constructor.  To account for symbolizers that may intersect
   * this extent, we calculate a buffered extent (e.g. based on stroke width).
   * @return {import("../../extent.js").Extent} The buffered rendering extent.
   * @protected
   */
  getBufferedMaxExtent() {
    if (!this.bufferedMaxExtent_) {
      this.bufferedMaxExtent_ = clone(this.maxExtent);
      if (this.maxLineWidth > 0) {
        const width = this.resolution * (this.maxLineWidth + 1) / 2;
        buffer(this.bufferedMaxExtent_, width, this.bufferedMaxExtent_);
      }
    }
    return this.bufferedMaxExtent_;
  }
}


export default CanvasInstructionsBuilder;
