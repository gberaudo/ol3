/**
 * @module ol/render/canvas/InstructionsExecutor
 */
import {getUid} from '../../util.js';
import {equals, reverseSubArray} from '../../array.js';
import {buffer, clone, createEmpty, createOrUpdate,
  createOrUpdateEmpty, extend, extendCoordinate, intersects} from '../../extent.js';
import {lineStringLength} from '../../geom/flat/length.js';
import {drawTextOnPath} from '../../geom/flat/textpath.js';
import {transform2D} from '../../geom/flat/transform.js';
import {CANVAS_LINE_DASH} from '../../has.js';
import {isEmpty} from '../../obj.js';
import {drawImage, resetTransform, defaultPadding} from '../canvas.js';
import CanvasInstruction from './Instruction.js';
import {TEXT_ALIGN} from '../replay.js';
import {
  create as createTransform,
  compose as composeTransform,
  apply as applyTransform,
  setFromArray as transformSetFromArray
} from '../../transform.js';


/// Imports copied from TextReplay
import {asColorLike} from '../../colorlike.js';
import {createCanvasContext2D} from '../../dom.js';
import {labelCache, measureTextWidth, defaultTextAlign, measureTextHeight, defaultLineCap, defaultLineDashOffset, defaultLineDash, defaultLineJoin, defaultFillStyle, checkFont, defaultFont, defaultLineWidth, defaultMiterLimit, defaultStrokeStyle, defaultTextBaseline} from '../canvas.js';


/**
 * @typedef {Object} SerializableInstructions
 * @property {Array<*>} instructions The rendering instructions.
 * @property {Array<*>} hitDetectionInstructions The rendering hit detection instructions.
 * @property {Array<number>} coordinates The array of all coordinates.
 * @property {!Object<string, import("../canvas.js").TextState>} textStates The text states (decluttering).
 * @property {!Object<string, import("../canvas.js").FillState>} fillStates The fill states (decluttering).
 * @property {!Object<string, import("../canvas.js").StrokeState>} strokeStates The stoke states (decluttering).
 */

/**
 * @type {import("../../extent.js").Extent}
 */
const tmpExtent = createEmpty();


/**
 * @type {!import("../../transform.js").Transform}
 */
const tmpTransform = createTransform();


class CanvasInstructionsExecutor {
  /**
   * @param {number} tolerance Tolerance.
   * @param {import("../../extent.js").Extent} maxExtent Maximum extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {boolean} overlaps The replay can have overlapping geometries.
   * @param {?} declutterTree Declutter tree.
   */
  constructor(tolerance, maxExtent, resolution, pixelRatio, overlaps, declutterTree) {

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

    ////////////// Below is code copied from TextReplay ////////////


    /**
     * @private
     * @type {Array<HTMLCanvasElement>}
     */
    this.labels_ = null;

    /**
     * @private
     * @type {string}
     */
    this.text_ = '';

    /**
     * @private
     * @type {number}
     */
    this.textOffsetX_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.textOffsetY_ = 0;

    /**
     * @private
     * @type {boolean|undefined}
     */
    this.textRotateWithView_ = undefined;

    /**
     * @private
     * @type {number}
     */
    this.textRotation_ = 0;

    /**
     * @private
     * @type {?import("../canvas.js").FillState}
     */
    this.textFillState_ = null;

    /**
     * @type {!Object<string, import("../canvas.js").FillState>}
     */
    this.fillStates = {};

    /**
     * @private
     * @type {?import("../canvas.js").StrokeState}
     */
    this.textStrokeState_ = null;

    /**
     * @type {!Object<string, import("../canvas.js").StrokeState>}
     */
    this.strokeStates = {};

    /**
     * @private
     * @type {import("../canvas.js").TextState}
     */
    this.textState_ = /** @type {import("../canvas.js").TextState} */ ({});

    /**
     * @type {!Object<string, import("../canvas.js").TextState>}
     */
    this.textStates = {};

    /**
     * @private
     * @type {string}
     */
    this.textKey_ = '';

    /**
     * @private
     * @type {string}
     */
    this.fillKey_ = '';

    /**
     * @private
     * @type {string}
     */
    this.strokeKey_ = '';

    /**
     * @private
     * @type {Object<string, Object<string, number>>}
     */
    this.widths_ = {};

    labelCache.prune();
  }


  /**
   * @param {string} text Text.
   * @param {string} textKey Text style key.
   * @param {string} fillKey Fill style key.
   * @param {string} strokeKey Stroke style key.
   * @return {HTMLCanvasElement} Image.
   */
  getImage(text, textKey, fillKey, strokeKey) {
    let label;
    const key = strokeKey + textKey + text + fillKey + this.pixelRatio;

    if (!labelCache.containsKey(key)) {
      const strokeState = strokeKey ? this.strokeStates[strokeKey] || this.textStrokeState_ : null;
      const fillState = fillKey ? this.fillStates[fillKey] || this.textFillState_ : null;
      const textState = this.textStates[textKey] || this.textState_;
      const pixelRatio = this.pixelRatio;
      const scale = textState.scale * pixelRatio;
      const align = TEXT_ALIGN[textState.textAlign || defaultTextAlign];
      const strokeWidth = strokeKey && strokeState.lineWidth ? strokeState.lineWidth : 0;

      const lines = text.split('\n');
      const numLines = lines.length;
      const widths = [];
      const width = measureTextWidths(textState.font, lines, widths);
      const lineHeight = measureTextHeight(textState.font);
      const height = lineHeight * numLines;
      const renderWidth = (width + strokeWidth);
      const context = createCanvasContext2D(
        Math.ceil(renderWidth * scale),
        Math.ceil((height + strokeWidth) * scale));
      label = context.canvas;
      labelCache.set(key, label);
      if (scale != 1) {
        context.scale(scale, scale);
      }
      context.font = textState.font;
      if (strokeKey) {
        context.strokeStyle = strokeState.strokeStyle;
        context.lineWidth = strokeWidth;
        context.lineCap = /** @type {CanvasLineCap} */ (strokeState.lineCap);
        context.lineJoin = /** @type {CanvasLineJoin} */ (strokeState.lineJoin);
        context.miterLimit = strokeState.miterLimit;
        if (CANVAS_LINE_DASH && strokeState.lineDash.length) {
          context.setLineDash(strokeState.lineDash);
          context.lineDashOffset = strokeState.lineDashOffset;
        }
      }
      if (fillKey) {
        context.fillStyle = fillState.fillStyle;
      }
      context.textBaseline = 'middle';
      context.textAlign = 'center';
      const leftRight = (0.5 - align);
      const x = align * label.width / scale + leftRight * strokeWidth;
      let i;
      if (strokeKey) {
        for (i = 0; i < numLines; ++i) {
          context.strokeText(lines[i], x + leftRight * widths[i], 0.5 * (strokeWidth + lineHeight) + i * lineHeight);
        }
      }
      if (fillKey) {
        for (i = 0; i < numLines; ++i) {
          context.fillText(lines[i], x + leftRight * widths[i], 0.5 * (strokeWidth + lineHeight) + i * lineHeight);
        }
      }
    }
    return labelCache.get(key);
  }

  /**
   * @private
   * @param {HTMLCanvasElement} label Label.
   * @param {number} begin Begin.
   * @param {number} end End.
   */
  drawTextImage_(label, begin, end) {
    const textState = this.textState_;
    const strokeState = this.textStrokeState_;
    const pixelRatio = this.pixelRatio;
    const align = TEXT_ALIGN[textState.textAlign || defaultTextAlign];
    const baseline = TEXT_ALIGN[textState.textBaseline];
    const strokeWidth = strokeState && strokeState.lineWidth ? strokeState.lineWidth : 0;

    const anchorX = align * label.width / pixelRatio + 2 * (0.5 - align) * strokeWidth;
    const anchorY = baseline * label.height / pixelRatio + 2 * (0.5 - baseline) * strokeWidth;
    this.instructions.push([CanvasInstruction.DRAW_IMAGE, begin, end,
      label, (anchorX - this.textOffsetX_) * pixelRatio, (anchorY - this.textOffsetY_) * pixelRatio,
      this.declutterGroup_, label.height, 1, 0, 0, this.textRotateWithView_, this.textRotation_,
      1, label.width,
      textState.padding == defaultPadding ?
        defaultPadding : textState.padding.map(function(p) {
          return p * pixelRatio;
        }),
      !!textState.backgroundFill, !!textState.backgroundStroke
    ]);
    this.hitDetectionInstructions.push([CanvasInstruction.DRAW_IMAGE, begin, end,
      label, (anchorX - this.textOffsetX_) * pixelRatio, (anchorY - this.textOffsetY_) * pixelRatio,
      this.declutterGroup_, label.height, 1, 0, 0, this.textRotateWithView_, this.textRotation_,
      1 / pixelRatio, label.width, textState.padding,
      !!textState.backgroundFill, !!textState.backgroundStroke
    ]);
  }

  /**
   * @private
   * @param {number} begin Begin.
   * @param {number} end End.
   * @param {import("../canvas.js").DeclutterGroup} declutterGroup Declutter group.
   */
  drawChars_(begin, end, declutterGroup) {
    const strokeState = this.textStrokeState_;
    const textState = this.textState_;
    const fillState = this.textFillState_;

    const strokeKey = this.strokeKey_;
    if (strokeState) {
      if (!(strokeKey in this.strokeStates)) {
        this.strokeStates[strokeKey] = /** @type {import("../canvas.js").StrokeState} */ ({
          strokeStyle: strokeState.strokeStyle,
          lineCap: strokeState.lineCap,
          lineDashOffset: strokeState.lineDashOffset,
          lineWidth: strokeState.lineWidth,
          lineJoin: strokeState.lineJoin,
          miterLimit: strokeState.miterLimit,
          lineDash: strokeState.lineDash
        });
      }
    }
    const textKey = this.textKey_;
    if (!(this.textKey_ in this.textStates)) {
      this.textStates[this.textKey_] = /** @type {import("../canvas.js").TextState} */ ({
        font: textState.font,
        textAlign: textState.textAlign || defaultTextAlign,
        scale: textState.scale
      });
    }
    const fillKey = this.fillKey_;
    if (fillState) {
      if (!(fillKey in this.fillStates)) {
        this.fillStates[fillKey] = /** @type {import("../canvas.js").FillState} */ ({
          fillStyle: fillState.fillStyle
        });
      }
    }

    const pixelRatio = this.pixelRatio;
    const baseline = TEXT_ALIGN[textState.textBaseline];

    const offsetY = this.textOffsetY_ * pixelRatio;
    const text = this.text_;
    const font = textState.font;
    const textScale = textState.scale;
    const strokeWidth = strokeState ? strokeState.lineWidth * textScale / 2 : 0;
    let widths = this.widths_[font];
    if (!widths) {
      this.widths_[font] = widths = {};
    }
    this.instructions.push([CanvasInstruction.DRAW_CHARS,
      begin, end, baseline, declutterGroup,
      textState.overflow, fillKey, textState.maxAngle,
      function(text) {
        let width = widths[text];
        if (!width) {
          width = widths[text] = measureTextWidth(font, text);
        }
        return width * textScale * pixelRatio;
      },
      offsetY, strokeKey, strokeWidth * pixelRatio, text, textKey, 1
    ]);
    this.hitDetectionInstructions.push([CanvasInstruction.DRAW_CHARS,
      begin, end, baseline, declutterGroup,
      textState.overflow, fillKey, textState.maxAngle,
      function(text) {
        let width = widths[text];
        if (!width) {
          width = widths[text] = measureTextWidth(font, text);
        }
        return width * textScale;
      },
      offsetY, strokeKey, strokeWidth, text, textKey, 1 / pixelRatio
    ]);
  }

  /**
   * @inheritDoc
   */
  setTextStyle(textStyle, declutterGroup) {
    let textState, fillState, strokeState;
    if (!textStyle) {
      this.text_ = '';
    } else {
      this.declutterGroup_ = /** @type {import("../canvas.js").DeclutterGroup} */ (declutterGroup);

      const textFillStyle = textStyle.getFill();
      if (!textFillStyle) {
        fillState = this.textFillState_ = null;
      } else {
        fillState = this.textFillState_;
        if (!fillState) {
          fillState = this.textFillState_ = /** @type {import("../canvas.js").FillState} */ ({});
        }
        fillState.fillStyle = asColorLike(
          textFillStyle.getColor() || defaultFillStyle);
      }

      const textStrokeStyle = textStyle.getStroke();
      if (!textStrokeStyle) {
        strokeState = this.textStrokeState_ = null;
      } else {
        strokeState = this.textStrokeState_;
        if (!strokeState) {
          strokeState = this.textStrokeState_ = /** @type {import("../canvas.js").StrokeState} */ ({});
        }
        const lineDash = textStrokeStyle.getLineDash();
        const lineDashOffset = textStrokeStyle.getLineDashOffset();
        const lineWidth = textStrokeStyle.getWidth();
        const miterLimit = textStrokeStyle.getMiterLimit();
        strokeState.lineCap = textStrokeStyle.getLineCap() || defaultLineCap;
        strokeState.lineDash = lineDash ? lineDash.slice() : defaultLineDash;
        strokeState.lineDashOffset =
            lineDashOffset === undefined ? defaultLineDashOffset : lineDashOffset;
        strokeState.lineJoin = textStrokeStyle.getLineJoin() || defaultLineJoin;
        strokeState.lineWidth =
            lineWidth === undefined ? defaultLineWidth : lineWidth;
        strokeState.miterLimit =
            miterLimit === undefined ? defaultMiterLimit : miterLimit;
        strokeState.strokeStyle = asColorLike(
          textStrokeStyle.getColor() || defaultStrokeStyle);
      }

      textState = this.textState_;
      const font = textStyle.getFont() || defaultFont;
      checkFont(font);
      const textScale = textStyle.getScale();
      textState.overflow = textStyle.getOverflow();
      textState.font = font;
      textState.maxAngle = textStyle.getMaxAngle();
      textState.placement = textStyle.getPlacement();
      textState.textAlign = textStyle.getTextAlign();
      textState.textBaseline = textStyle.getTextBaseline() || defaultTextBaseline;
      textState.backgroundFill = textStyle.getBackgroundFill();
      textState.backgroundStroke = textStyle.getBackgroundStroke();
      textState.padding = textStyle.getPadding() || defaultPadding;
      textState.scale = textScale === undefined ? 1 : textScale;

      const textOffsetX = textStyle.getOffsetX();
      const textOffsetY = textStyle.getOffsetY();
      const textRotateWithView = textStyle.getRotateWithView();
      const textRotation = textStyle.getRotation();
      this.text_ = textStyle.getText() || '';
      this.textOffsetX_ = textOffsetX === undefined ? 0 : textOffsetX;
      this.textOffsetY_ = textOffsetY === undefined ? 0 : textOffsetY;
      this.textRotateWithView_ = textRotateWithView === undefined ? false : textRotateWithView;
      this.textRotation_ = textRotation === undefined ? 0 : textRotation;

      this.strokeKey_ = strokeState ?
        (typeof strokeState.strokeStyle == 'string' ? strokeState.strokeStyle : getUid(strokeState.strokeStyle)) +
        strokeState.lineCap + strokeState.lineDashOffset + '|' + strokeState.lineWidth +
        strokeState.lineJoin + strokeState.miterLimit + '[' + strokeState.lineDash.join() + ']' :
        '';
      this.textKey_ = textState.font + textState.scale + (textState.textAlign || '?');
      this.fillKey_ = fillState ?
        (typeof fillState.fillStyle == 'string' ? fillState.fillStyle : ('|' + getUid(fillState.fillStyle))) :
        '';
    }
  }

  ////////////// Above is code from TextReplay //////////////////

  /**
   * Recreate replays and populate them using the provided instructions.
   * @param {SerializableInstructions} instructions The serializable instructions
   */
  replaceInstructions(instructions) {
    this.instructions = instructions.instructions;
    this.hitDetectionInstructions = instructions.hitDetectionInstructions;
    this.coordinates = instructions.coordinates;
    // Workaround for decluttered text creation / rendering being coupled
    this.textStates = instructions.textStates;
    this.fillStates = instructions.fillStates;
    this.strokeStates = instructions.strokeStates;
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../coordinate.js").Coordinate} p1 1st point of the background box.
   * @param {import("../../coordinate.js").Coordinate} p2 2nd point of the background box.
   * @param {import("../../coordinate.js").Coordinate} p3 3rd point of the background box.
   * @param {import("../../coordinate.js").Coordinate} p4 4th point of the background box.
   * @param {Array<*>} fillInstruction Fill instruction.
   * @param {Array<*>} strokeInstruction Stroke instruction.
   */
  replayTextBackground_(context, p1, p2, p3, p4, fillInstruction, strokeInstruction) {
    context.beginPath();
    context.moveTo.apply(context, p1);
    context.lineTo.apply(context, p2);
    context.lineTo.apply(context, p3);
    context.lineTo.apply(context, p4);
    context.lineTo.apply(context, p1);
    if (fillInstruction) {
      this.alignFill_ = /** @type {boolean} */ (fillInstruction[2]);
      this.fill_(context);
    }
    if (strokeInstruction) {
      this.setStrokeStyle_(context, /** @type {Array<*>} */ (strokeInstruction));
      context.stroke();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {number} x X.
   * @param {number} y Y.
   * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} image Image.
   * @param {number} anchorX Anchor X.
   * @param {number} anchorY Anchor Y.
   * @param {import("../canvas.js").DeclutterGroup} declutterGroup Declutter group.
   * @param {number} height Height.
   * @param {number} opacity Opacity.
   * @param {number} originX Origin X.
   * @param {number} originY Origin Y.
   * @param {number} rotation Rotation.
   * @param {number} scale Scale.
   * @param {boolean} snapToPixel Snap to pixel.
   * @param {number} width Width.
   * @param {Array<number>} padding Padding.
   * @param {Array<*>} fillInstruction Fill instruction.
   * @param {Array<*>} strokeInstruction Stroke instruction.
   */
  replayImage_(
    context,
    x,
    y,
    image,
    anchorX,
    anchorY,
    declutterGroup,
    height,
    opacity,
    originX,
    originY,
    rotation,
    scale,
    snapToPixel,
    width,
    padding,
    fillInstruction,
    strokeInstruction
  ) {
    const fillStroke = fillInstruction || strokeInstruction;
    anchorX *= scale;
    anchorY *= scale;
    x -= anchorX;
    y -= anchorY;

    const w = (width + originX > image.width) ? image.width - originX : width;
    const h = (height + originY > image.height) ? image.height - originY : height;
    const boxW = padding[3] + w * scale + padding[1];
    const boxH = padding[0] + h * scale + padding[2];
    const boxX = x - padding[3];
    const boxY = y - padding[0];

    /** @type {import("../../coordinate.js").Coordinate} */
    let p1;
    /** @type {import("../../coordinate.js").Coordinate} */
    let p2;
    /** @type {import("../../coordinate.js").Coordinate} */
    let p3;
    /** @type {import("../../coordinate.js").Coordinate} */
    let p4;
    if (fillStroke || rotation !== 0) {
      p1 = [boxX, boxY];
      p2 = [boxX + boxW, boxY];
      p3 = [boxX + boxW, boxY + boxH];
      p4 = [boxX, boxY + boxH];
    }

    let transform = null;
    if (rotation !== 0) {
      const centerX = x + anchorX;
      const centerY = y + anchorY;
      transform = composeTransform(tmpTransform, centerX, centerY, 1, 1, rotation, -centerX, -centerY);

      createOrUpdateEmpty(tmpExtent);
      extendCoordinate(tmpExtent, applyTransform(tmpTransform, p1));
      extendCoordinate(tmpExtent, applyTransform(tmpTransform, p2));
      extendCoordinate(tmpExtent, applyTransform(tmpTransform, p3));
      extendCoordinate(tmpExtent, applyTransform(tmpTransform, p4));
    } else {
      createOrUpdate(boxX, boxY, boxX + boxW, boxY + boxH, tmpExtent);
    }
    const canvas = context.canvas;
    const strokePadding = strokeInstruction ? (strokeInstruction[2] * scale / 2) : 0;
    const intersects =
        tmpExtent[0] - strokePadding <= canvas.width && tmpExtent[2] + strokePadding >= 0 &&
        tmpExtent[1] - strokePadding <= canvas.height && tmpExtent[3] + strokePadding >= 0;

    if (snapToPixel) {
      x = Math.round(x);
      y = Math.round(y);
    }

    if (declutterGroup) {
      if (!intersects && declutterGroup[4] == 1) {
        return;
      }
      extend(declutterGroup, tmpExtent);
      const declutterArgs = intersects ?
        [context, transform ? transform.slice(0) : null, opacity, image, originX, originY, w, h, x, y, scale] :
        null;
      if (declutterArgs && fillStroke) {
        declutterArgs.push(fillInstruction, strokeInstruction, p1, p2, p3, p4);
      }
      declutterGroup.push(declutterArgs);
    } else if (intersects) {
      if (fillStroke) {
        this.replayTextBackground_(context, p1, p2, p3, p4,
          /** @type {Array<*>} */ (fillInstruction),
          /** @type {Array<*>} */ (strokeInstruction));
      }
      drawImage(context, transform, opacity, image, originX, originY, w, h, x, y, scale);
    }
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
   * @private
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../transform.js").Transform} transform Transform.
   * @param {Object<string, boolean>} skippedFeaturesHash Ids of features
   *     to skip.
   * @param {Array<*>} instructions Instructions array.
   * @param {boolean} snapToPixel Snap point symbols and text to integer pixels.
   * @param {function((import("../../Feature.js").default|import("../Feature.js").default)): T|undefined} featureCallback Feature callback.
   * @param {import("../../extent.js").Extent=} opt_hitExtent Only check features that intersect this
   *     extent.
   * @return {T|undefined} Callback result.
   * @template T
   */
  replay_(
    context,
    transform,
    skippedFeaturesHash,
    instructions,
    snapToPixel,
    featureCallback,
    opt_hitExtent
  ) {
    /** @type {Array<number>} */
    let pixelCoordinates;
    if (this.pixelCoordinates_ && equals(transform, this.renderedTransform_)) {
      pixelCoordinates = this.pixelCoordinates_;
    } else {
      if (!this.pixelCoordinates_) {
        this.pixelCoordinates_ = [];
      }
      pixelCoordinates = transform2D(
        this.coordinates, 0, this.coordinates.length, 2,
        transform, this.pixelCoordinates_);
      transformSetFromArray(this.renderedTransform_, transform);
    }
    const skipFeatures = !isEmpty(skippedFeaturesHash);
    let i = 0; // instruction index
    const ii = instructions.length; // end of instructions
    let d = 0; // data index
    let dd; // end of per-instruction data
    let anchorX, anchorY, prevX, prevY, roundX, roundY, declutterGroup, image;
    let pendingFill = 0;
    let pendingStroke = 0;
    let lastFillInstruction = null;
    let lastStrokeInstruction = null;
    const coordinateCache = this.coordinateCache_;
    const viewRotation = this.viewRotation_;

    const state = /** @type {import("../../render.js").State} */ ({
      context: context,
      pixelRatio: this.pixelRatio,
      resolution: this.resolution,
      rotation: viewRotation
    });

    // When the batch size gets too big, performance decreases. 200 is a good
    // balance between batch size and number of fill/stroke instructions.
    const batchSize = this.instructions != instructions || this.overlaps ? 0 : 200;
    let /** @type {import("../../Feature.js").default|import("../Feature.js").default} */ feature;
    let x, y;
    while (i < ii) {
      const instruction = instructions[i];
      const type = /** @type {CanvasInstruction} */ (instruction[0]);
      switch (type) {
        case CanvasInstruction.BEGIN_GEOMETRY:
          feature = /** @type {import("../../Feature.js").default|import("../Feature.js").default} */ (instruction[1]);
          if ((skipFeatures && skippedFeaturesHash[getUid(feature)]) || !feature.getGeometry()) {
            i = /** @type {number} */ (instruction[2]);
          } else if (opt_hitExtent !== undefined && !intersects(
            opt_hitExtent, feature.getGeometry().getExtent())) {
            i = /** @type {number} */ (instruction[2]) + 1;
          } else {
            ++i;
          }
          break;
        case CanvasInstruction.BEGIN_PATH:
          if (pendingFill > batchSize) {
            this.fill_(context);
            pendingFill = 0;
          }
          if (pendingStroke > batchSize) {
            context.stroke();
            pendingStroke = 0;
          }
          if (!pendingFill && !pendingStroke) {
            context.beginPath();
            prevX = prevY = NaN;
          }
          ++i;
          break;
        case CanvasInstruction.CIRCLE:
          d = /** @type {number} */ (instruction[1]);
          const x1 = pixelCoordinates[d];
          const y1 = pixelCoordinates[d + 1];
          const x2 = pixelCoordinates[d + 2];
          const y2 = pixelCoordinates[d + 3];
          const dx = x2 - x1;
          const dy = y2 - y1;
          const r = Math.sqrt(dx * dx + dy * dy);
          context.moveTo(x1 + r, y1);
          context.arc(x1, y1, r, 0, 2 * Math.PI, true);
          ++i;
          break;
        case CanvasInstruction.CLOSE_PATH:
          context.closePath();
          ++i;
          break;
        case CanvasInstruction.CUSTOM:
          d = /** @type {number} */ (instruction[1]);
          dd = instruction[2];
          const geometry = /** @type {import("../../geom/SimpleGeometry.js").default} */ (instruction[3]);
          const renderer = instruction[4];
          const fn = instruction.length == 6 ? instruction[5] : undefined;
          state.geometry = geometry;
          state.feature = feature;
          if (!(i in coordinateCache)) {
            coordinateCache[i] = [];
          }
          const coords = coordinateCache[i];
          if (fn) {
            fn(pixelCoordinates, d, dd, 2, coords);
          } else {
            coords[0] = pixelCoordinates[d];
            coords[1] = pixelCoordinates[d + 1];
            coords.length = 2;
          }
          renderer(coords, state);
          ++i;
          break;
        case CanvasInstruction.DRAW_IMAGE:
          d = /** @type {number} */ (instruction[1]);
          dd = /** @type {number} */ (instruction[2]);
          image = /** @type {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} */
              (instruction[3]);
          // Remaining arguments in DRAW_IMAGE are in alphabetical order
          anchorX = /** @type {number} */ (instruction[4]);
          anchorY = /** @type {number} */ (instruction[5]);
          declutterGroup = featureCallback ? null : /** @type {import("../canvas.js").DeclutterGroup} */ (instruction[6]);
          const height = /** @type {number} */ (instruction[7]);
          const opacity = /** @type {number} */ (instruction[8]);
          const originX = /** @type {number} */ (instruction[9]);
          const originY = /** @type {number} */ (instruction[10]);
          const rotateWithView = /** @type {boolean} */ (instruction[11]);
          let rotation = /** @type {number} */ (instruction[12]);
          const scale = /** @type {number} */ (instruction[13]);
          const width = /** @type {number} */ (instruction[14]);

          let padding, backgroundFill, backgroundStroke;
          if (instruction.length > 16) {
            padding = /** @type {Array<number>} */ (instruction[15]);
            backgroundFill = /** @type {boolean} */ (instruction[16]);
            backgroundStroke = /** @type {boolean} */ (instruction[17]);
          } else {
            padding = defaultPadding;
            backgroundFill = backgroundStroke = false;
          }

          if (rotateWithView) {
            rotation += viewRotation;
          }
          for (; d < dd; d += 2) {
            this.replayImage_(context,
              pixelCoordinates[d], pixelCoordinates[d + 1], image, anchorX, anchorY,
              declutterGroup, height, opacity, originX, originY, rotation, scale,
              snapToPixel, width, padding,
              backgroundFill ? /** @type {Array<*>} */ (lastFillInstruction) : null,
              backgroundStroke ? /** @type {Array<*>} */ (lastStrokeInstruction) : null);
          }
          this.renderDeclutter_(declutterGroup, feature);
          ++i;
          break;
        case CanvasInstruction.DRAW_CHARS:
          const begin = /** @type {number} */ (instruction[1]);
          const end = /** @type {number} */ (instruction[2]);
          const baseline = /** @type {number} */ (instruction[3]);
          declutterGroup = featureCallback ? null : /** @type {import("../canvas.js").DeclutterGroup} */ (instruction[4]);
          const overflow = /** @type {number} */ (instruction[5]);
          const fillKey = /** @type {string} */ (instruction[6]);
          const maxAngle = /** @type {number} */ (instruction[7]);
          const measure = /** @type {function(string):number} */ (instruction[8]);
          const offsetY = /** @type {number} */ (instruction[9]);
          const strokeKey = /** @type {string} */ (instruction[10]);
          const strokeWidth = /** @type {number} */ (instruction[11]);
          const text = /** @type {string} */ (instruction[12]);
          const textKey = /** @type {string} */ (instruction[13]);
          const textScale = /** @type {number} */ (instruction[14]);

          const pathLength = lineStringLength(pixelCoordinates, begin, end, 2);
          const textLength = measure(text);
          if (overflow || textLength <= pathLength) {
            /** @type {import("./TextBuilder.js").default} */
            const textReplay = /** @type {?} */ (this);
            const textAlign = textReplay.textStates[textKey].textAlign;
            const startM = (pathLength - textLength) * TEXT_ALIGN[textAlign];
            const parts = drawTextOnPath(
              pixelCoordinates, begin, end, 2, text, measure, startM, maxAngle);
            if (parts) {
              let c, cc, chars, label, part;
              if (strokeKey) {
                for (c = 0, cc = parts.length; c < cc; ++c) {
                  part = parts[c]; // x, y, anchorX, rotation, chunk
                  chars = /** @type {string} */ (part[4]);
                  label = textReplay.getImage(chars, textKey, '', strokeKey);
                  anchorX = /** @type {number} */ (part[2]) + strokeWidth;
                  anchorY = baseline * label.height + (0.5 - baseline) * 2 * strokeWidth - offsetY;
                  this.replayImage_(context,
                    /** @type {number} */ (part[0]), /** @type {number} */ (part[1]), label,
                    anchorX, anchorY, declutterGroup, label.height, 1, 0, 0,
                    /** @type {number} */ (part[3]), textScale, false, label.width,
                    defaultPadding, null, null);
                }
              }
              if (fillKey) {
                for (c = 0, cc = parts.length; c < cc; ++c) {
                  part = parts[c]; // x, y, anchorX, rotation, chunk
                  chars = /** @type {string} */ (part[4]);
                  label = textReplay.getImage(chars, textKey, fillKey, '');
                  anchorX = /** @type {number} */ (part[2]);
                  anchorY = baseline * label.height - offsetY;
                  this.replayImage_(context,
                    /** @type {number} */ (part[0]), /** @type {number} */ (part[1]), label,
                    anchorX, anchorY, declutterGroup, label.height, 1, 0, 0,
                    /** @type {number} */ (part[3]), textScale, false, label.width,
                    defaultPadding, null, null);
                }
              }
            }
          }
          this.renderDeclutter_(declutterGroup, feature);
          ++i;
          break;
        case CanvasInstruction.END_GEOMETRY:
          if (featureCallback !== undefined) {
            feature = /** @type {import("../../Feature.js").default|import("../Feature.js").default} */ (instruction[1]);
            const result = featureCallback(feature);
            if (result) {
              return result;
            }
          }
          ++i;
          break;
        case CanvasInstruction.FILL:
          if (batchSize) {
            pendingFill++;
          } else {
            this.fill_(context);
          }
          ++i;
          break;
        case CanvasInstruction.MOVE_TO_LINE_TO:
          d = /** @type {number} */ (instruction[1]);
          dd = /** @type {number} */ (instruction[2]);
          x = pixelCoordinates[d];
          y = pixelCoordinates[d + 1];
          roundX = (x + 0.5) | 0;
          roundY = (y + 0.5) | 0;
          if (roundX !== prevX || roundY !== prevY) {
            context.moveTo(x, y);
            prevX = roundX;
            prevY = roundY;
          }
          for (d += 2; d < dd; d += 2) {
            x = pixelCoordinates[d];
            y = pixelCoordinates[d + 1];
            roundX = (x + 0.5) | 0;
            roundY = (y + 0.5) | 0;
            if (d == dd - 2 || roundX !== prevX || roundY !== prevY) {
              context.lineTo(x, y);
              prevX = roundX;
              prevY = roundY;
            }
          }
          ++i;
          break;
        case CanvasInstruction.SET_FILL_STYLE:
          lastFillInstruction = instruction;
          this.alignFill_ = instruction[2];

          if (pendingFill) {
            this.fill_(context);
            pendingFill = 0;
            if (pendingStroke) {
              context.stroke();
              pendingStroke = 0;
            }
          }

          context.fillStyle = /** @type {import("../../colorlike.js").ColorLike} */ (instruction[1]);
          ++i;
          break;
        case CanvasInstruction.SET_STROKE_STYLE:
          lastStrokeInstruction = instruction;
          if (pendingStroke) {
            context.stroke();
            pendingStroke = 0;
          }
          this.setStrokeStyle_(context, /** @type {Array<*>} */ (instruction));
          ++i;
          break;
        case CanvasInstruction.STROKE:
          if (batchSize) {
            pendingStroke++;
          } else {
            context.stroke();
          }
          ++i;
          break;
        default:
          ++i; // consume the instruction anyway, to avoid an infinite loop
          break;
      }
    }
    if (pendingFill) {
      this.fill_(context);
    }
    if (pendingStroke) {
      context.stroke();
    }
    return undefined;
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../transform.js").Transform} transform Transform.
   * @param {number} viewRotation View rotation.
   * @param {Object<string, boolean>} skippedFeaturesHash Ids of features
   *     to skip.
   * @param {boolean} snapToPixel Snap point symbols and text to integer pixels.
   */
  replay(context, transform, viewRotation, skippedFeaturesHash, snapToPixel) {
    this.viewRotation_ = viewRotation;
    this.replay_(context, transform,
      skippedFeaturesHash, this.instructions, snapToPixel, undefined, undefined);
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../transform.js").Transform} transform Transform.
   * @param {number} viewRotation View rotation.
   * @param {Object<string, boolean>} skippedFeaturesHash Ids of features
   *     to skip.
   * @param {function((import("../../Feature.js").default|import("../Feature.js").default)): T=} opt_featureCallback
   *     Feature callback.
   * @param {import("../../extent.js").Extent=} opt_hitExtent Only check features that intersect this
   *     extent.
   * @return {T|undefined} Callback result.
   * @template T
   */
  replayHitDetection(
    context,
    transform,
    viewRotation,
    skippedFeaturesHash,
    opt_featureCallback,
    opt_hitExtent
  ) {
    this.viewRotation_ = viewRotation;
    return this.replay_(context, transform, skippedFeaturesHash,
      this.hitDetectionInstructions, true, opt_featureCallback, opt_hitExtent);
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


export default CanvasInstructionsExecutor;


/////////////// Below is code copied from TextReplay /////////////////

/**
 * @param {string} font Font to use for measuring.
 * @param {Array<string>} lines Lines to measure.
 * @param {Array<number>} widths Array will be populated with the widths of
 * each line.
 * @return {number} Width of the whole text.
 */
export function measureTextWidths(font, lines, widths) {
  const numLines = lines.length;
  let width = 0;
  for (let i = 0; i < numLines; ++i) {
    const currentWidth = measureTextWidth(font, lines[i]);
    width = Math.max(width, currentWidth);
    widths.push(currentWidth);
  }
  return width;
}
