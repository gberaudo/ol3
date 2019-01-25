/**
 * @module ol/renderer/canvas/VectorTileLayer
 */
import {getUid} from '../../util.js';
import {createCanvasContext2D} from '../../dom.js';
import TileState from '../../TileState.js';
import ViewHint from '../../ViewHint.js';
import {listen, unlisten, unlistenByKey} from '../../events.js';
import EventType from '../../events/EventType.js';
import rbush from 'rbush';
import {buffer, containsCoordinate, equals, getIntersection, getTopLeft, intersects} from '../../extent.js';
import VectorTileRenderType from '../../layer/VectorTileRenderType.js';
import {equivalent as equivalentProjection} from '../../proj.js';
import Units from '../../proj/Units.js';
import ReplayType from '../../render/canvas/BuilderType.js';
import {labelCache} from '../../render/canvas.js';
import CanvasBuilderGroup from '../../render/canvas/BuilderGroup.js';
import CanvasTileLayerRenderer from './TileLayer.js';
import {getSquaredTolerance as getSquaredRenderTolerance, renderFeature} from '../vector.js';
import {
  apply as applyTransform,
  create as createTransform,
  compose as composeTransform,
  reset as resetTransform,
  scale as scaleTransform,
  translate as translateTransform,
  toString as transformToString,
  makeScale,
  makeInverse
} from '../../transform.js';
import CanvasExecutorGroup, {replayDeclutter} from '../../render/canvas/ExecutorGroup.js';
import {isEmpty} from '../../obj.js';
import {loadImageUsingDom} from '../../loadImage.js';

const dateByTile = {};

function resizeCanvas(canvas, img) {
  if (canvas.width !== img.width) {
    canvas.width = img.width;
  }
  if (canvas.height !== img.height) {
    canvas.height = img.height;
  }
}

function pushImage(canvas, img) {
  // Most efficient method
  resizeCanvas(canvas, img);
  canvas.getContext('bitmaprenderer').transferFromImageBitmap(img);
  img.close();
}

/**
 * @type {!Object<string, Array<import("../../render/canvas/BuilderType.js").default>>}
 */
const IMAGE_REPLAYS = {
  'image': [ReplayType.POLYGON, ReplayType.CIRCLE,
    ReplayType.LINE_STRING, ReplayType.IMAGE, ReplayType.TEXT],
  'hybrid': [ReplayType.POLYGON, ReplayType.LINE_STRING]
};


/**
 * @type {!Object<string, Array<import("../../render/canvas/BuilderType.js").default>>}
 */
const VECTOR_REPLAYS = {
  'image': [ReplayType.DEFAULT],
  'hybrid': [ReplayType.IMAGE, ReplayType.TEXT, ReplayType.DEFAULT]
};


/**
 * @classdesc
 * Canvas renderer for vector tile layers.
 * @api
 */
class CanvasVectorTileLayerRenderer extends CanvasTileLayerRenderer {

  /**
   * @param {import("../../layer/VectorTile.js").default} layer VectorTile layer.
   */
  constructor(layer) {
    super(layer);

    const baseCanvas = this.context.canvas;

    this.currentWorkerMessageId_ = 0;
    this.tilesByWorkerMessageId_ = {};
    this.tilesByWorkerMessageIdCount_ = 0;

    this.worker_ = layer.getWorker();
    let previous = 0;
    const counter = () => {
      if (this.tilesByWorkerMessageIdCount_ !== previous) {
        console.log('count', this.tilesByWorkerMessageIdCount_);
        previous = this.tilesByWorkerMessageIdCount_;
      }
      requestAnimationFrame(counter);
    };
    if (this.worker_) {
      counter();
      this.worker_.addEventListener('message', this.onWorkerMessageReceived_.bind(this), false);
    }

    /**
     * @private
     * @type {CanvasRenderingContext2D}
     */
    this.overlayContext_ = createCanvasContext2D();

    const overlayCanvas = this.overlayContext_.canvas;
    let container = null;

    if (overlayCanvas.style) {
      overlayCanvas.style.position = 'absolute';
      overlayCanvas.style.transformOrigin = 'top left';

      container = document.createElement('div');
      const style = container.style;
      style.position = 'absolute';
      style.width = '100%';
      style.height = '100%';

      container.appendChild(baseCanvas);
      container.appendChild(overlayCanvas);
    }

    /**
     * @private
     * @type {HTMLElement}
     */
    this.container_ = container;

    /**
     * The transform for rendered pixels to viewport CSS pixels for the overlay canvas.
     * @private
     * @type {import("../../transform.js").Transform}
     */
    this.overlayPixelTransform_ = createTransform();

    /**
     * The transform for viewport CSS pixels to rendered pixels for the overlay canvas.
     * @private
     * @type {import("../../transform.js").Transform}
     */
    this.inverseOverlayPixelTransform_ = createTransform();

    /**
     * Declutter tree.
     * @private
     */
    this.declutterTree_ = layer.getDeclutter() ? rbush(9, undefined) : null;

    /**
     * @private
     * @type {boolean}
     */
    this.dirty_ = false;

    /**
     * @private
     * @type {number}
     */
    this.renderedLayerRevision_;

    /**
     * @private
     * @type {!Object<string, import("../../VectorRenderTile.js").default>}
     */
    this.renderTileImageQueue_ = {};

    /**
     * @type {Object<string, import("../../events.js").EventsKey>}
     */
    this.tileListenerKeys_ = {};

    /**
     * @private
     * @type {import("../../transform.js").Transform}
     */
    this.tmpTransform_ = createTransform();

    // Use closest resolution.
    this.zDirection = 0;

    listen(labelCache, EventType.CLEAR, this.handleFontsChanged_, this);

  }

  onWorkerMessageReceived_(event) {
    console.log('received event in main thread', event.data);
    const {images, action, messageId} = event.data;
    if (action === 'preparedTile') {
      const tile = this.tilesByWorkerMessageId_[messageId];
      const pixelRatio = tile['pixelRatio'];
      const projection = tile['projection'];
      const image = images[0];
      const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
      tile.getContext(this.getLayer(), canvas.getContext('bitmaprenderer'));
      pushImage(canvas, image);
      this.updateExecutorGroup_(tile, pixelRatio, projection);
      tile.hifi = true;
      tile.setState(TileState.LOADED);
    } else if (action === 'failedTilePreparation') {
      const tile = this.tilesByWorkerMessageId_[messageId];
      const state = event.data.state;
      tile.hifi = true;
      tile.setState(state);
      console.log('Failed', messageId);
    } else if (action === 'loadImage') {
      const {src, options, opaqueId} = event.data;
      const worker = this.worker_;
      const sendContinueMessage = function(img) {
        worker.postMessage({
          action: 'continueWorkerImageLoading',
          opaqueId,
          image: img
        },
        [img]);
      };
      loadImageUsingDom(src, options)
        .then(createImageBitmap)
        .then(sendContinueMessage);
      return;
    }
    delete this.tilesByWorkerMessageId_[messageId];
    --this.tilesByWorkerMessageIdCount_;
    delete dateByTile[messageId];
  }

  /**
   * @inheritDoc
   */
  disposeInternal() {
    unlisten(labelCache, EventType.CLEAR, this.handleFontsChanged_, this);
    super.disposeInternal();
  }

  /**
   * @param {import("../../VectorRenderTile.js").default} tile Tile.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../../proj/Projection").default} projection Projection.
   */
  prepareTile(tile, pixelRatio, projection) {
    const tileUid = getUid(tile);
    const state = tile.getState();
    if (((state === TileState.LOADED && tile.hifi) ||
        state === TileState.ERROR || state === TileState.ABORT) &&
        tileUid in this.tileListenerKeys_) {
      unlistenByKey(this.tileListenerKeys_[tileUid]);
      delete this.tileListenerKeys_[tileUid];
    }
    if (state === TileState.LOADED || state === TileState.ERROR) {
      this.updateExecutorGroup_(tile, pixelRatio, projection);
      if (this.tileImageNeedsRender_(tile, pixelRatio, projection)) {
        this.renderTileImageQueue_[tileUid] = tile;
      }
    }
  }

  prepareTileInWorker(z, x, y, pixelRatio, projection, opaqueTileId) {
    const tile = this.getTile(z, x, y, pixelRatio, projection);
    tile.opaque = opaqueTileId;
    const state = tile.getState();
    if (state === TileState.LOADING) {
      console.log('in worker getTile is loading, no luck', opaqueTileId, tile, state);
      console.log('this case results in a never released pending request');
    }
    if (state >= TileState.LOADED) {
      console.log('in worker getTile already known', opaqueTileId, tile, state);
      return new Promise(function(resolve, reject) {
        state === TileState.LOADED ? resolve(tile) : reject(tile);
      });
    }

    const that = this;
    const promise = new Promise(function(resolve, reject) {
      const listener = () => {
        try {
          const state = tile.getState();
          if (state === TileState.LOADED) {
            console.log('prepareTileInWorker loaded', opaqueTileId, state);
            that.renderTileImage_(tile, pixelRatio, projection);
            console.log('prepareTileInWorker loaded after renderTileImage', opaqueTileId, state);
            tile.removeEventListener('change', listener);
            resolve(tile);
          } else if (state === TileState.ERROR) {
            console.log('prepareTileInWorker error', opaqueTileId, state);
            tile.removeEventListener('change', listener);
            reject(tile);
          } else {
            if (state > TileState.LOADED) {
              console.log('other state', opaqueTileId, state);
            }
          }
        } catch (e) {
          console.log('prepareTileInWorker catch error', opaqueTileId, state);
          tile.setState(TileState.ERROR);
        }
      };
      tile.addEventListener('change', listener);
    });
    tile.load();
    console.log('prepareTileInWorker after tile.load()', opaqueTileId, state);
    return promise;
  }

  /**
   * @inheritDoc
   */
  getTile(z, x, y, pixelRatio, projection) {
    const tile = /** @type {import("../../VectorRenderTile.js").default} */ (super.getTile(z, x, y, pixelRatio, projection));
    const tileUid = getUid(tile);
    //     console.log(tileUid, tile.getState(), 'getTile(', z, x, y, ') / ';
    const worker = this.worker_;
    if (this.worker_) {
      if (tile.getState() === TileState.IDLE && !tile['HACK_DONE']) {
        const that = this;
        tile['load'] = function() {
          if (tile.getState() === TileState.IDLE) {
            const messageId = ++that.currentWorkerMessageId_;
            console.log(messageId, tile.getState(), 'load tile(', z, x, y, ') ');
            tile.setState(TileState.LOADING);
            tile['pixelRatio'] = pixelRatio;
            tile['projection'] = projection;
            const tileCoord = tile.getTileCoord();
            that.tilesByWorkerMessageId_[messageId] = tile;
            that.tilesByWorkerMessageIdCount_++;
            dateByTile[tileUid] = Date.now();
            worker.postMessage({
              action: 'prepareTile',
              tileCoord: tileCoord,
              messageId: messageId,
              pixelRatio: pixelRatio
            });
          }
          return [];
        };
        tile['HACK_DONE'] = true;
      }
    } else {
      if (tile.getState() < TileState.LOADED) {
        if (!(tileUid in this.tileListenerKeys_)) {
          const listenerKey = listen(tile, EventType.CHANGE, this.prepareTile.bind(this, tile, pixelRatio, projection));
          this.tileListenerKeys_[tileUid] = listenerKey;
        }
      } else {
        this.prepareTile(tile, pixelRatio, projection);
      }
    }
    return tile;
  }

  /**
   * @inheritdoc
   */
  isDrawableTile(tile) {
    return super.isDrawableTile(tile) && tile.hasContext(this.getLayer());
  }

  /**
   * @inheritDoc
   */
  getTileImage(tile) {
    const tileLayer = /** @type {import("../../layer/Tile.js").default} */ (this.getLayer());
    return tile.getImage(tileLayer);
  }

  /**
   * @inheritDoc
   */
  prepareFrame(frameState, layerState) {
    const layer = /** @type {import("../../layer/VectorTile.js").default} */ (this.getLayer());
    const layerRevision = layer.getRevision();
    if (this.renderedLayerRevision_ != layerRevision) {
      this.renderedTiles.length = 0;
    }
    this.renderedLayerRevision_ = layerRevision;
    return super.prepareFrame(frameState, layerState);
  }

  /**
   * @param {import("../../VectorRenderTile.js").default} tile Tile.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../../proj/Projection.js").default} projection Projection.
   * @private
   */
  updateExecutorGroup_(tile, pixelRatio, projection) {
    const layer = /** @type {import("../../layer/Vector.js").default} */ (this.getLayer());
    const revision = layer.getRevision();
    const renderOrder = /** @type {import("../../render.js").OrderFunction} */ (layer.getRenderOrder()) || null;

    const builderState = tile.getReplayState(layer);
    if (!builderState.dirty && builderState.renderedRevision == revision &&
        builderState.renderedRenderOrder == renderOrder && builderState.renderedZ === tile.sourceZ) {
      return;
    }

    const source = /** @type {import("../../source/VectorTile.js").default} */ (layer.getSource());
    const sourceTileGrid = source.getTileGrid();
    const tileGrid = source.getTileGridForProjection(projection);
    const zoom = tile.tileCoord[0];
    const resolution = tileGrid.getResolution(zoom);
    const tileExtent = tileGrid.getTileCoordExtent(tile.wrappedTileCoord);

    const sourceTiles = tile.load();
    const layerUid = getUid(layer);
    const executorGroups = tile.executorGroups[layerUid];
    if (executorGroups) {
      for (let i = 0, ii = executorGroups.length; i < ii; ++i) {
        executorGroups[i].dispose();
      }
    }
    tile.executorGroups[layerUid] = [];
    for (let t = 0, tt = sourceTiles.length; t < tt; ++t) {
      const sourceTile = sourceTiles[t];
      if (sourceTile.getState() != TileState.LOADED) {
        continue;
      }
      const sourceTileCoord = sourceTile.tileCoord;
      const sourceTileExtent = sourceTileGrid.getTileCoordExtent(sourceTileCoord);
      const sharedExtent = getIntersection(tileExtent, sourceTileExtent);
      const bufferedExtent = equals(sourceTileExtent, sharedExtent) ? null :
        buffer(sharedExtent, layer.getRenderBuffer() * resolution, this.tmpExtent);
      const tileProjection = sourceTile.getProjection();
      let reproject = false;
      if (!equivalentProjection(projection, tileProjection)) {
        reproject = true;
        sourceTile.setProjection(projection);
      }
      builderState.dirty = false;
      const builderGroup = new CanvasBuilderGroup(0, sharedExtent, resolution,
        pixelRatio, !!this.declutterTree_);
      const squaredTolerance = getSquaredRenderTolerance(resolution, pixelRatio);

      /**
       * @param {import("../../Feature.js").FeatureLike} feature Feature.
       * @this {CanvasVectorTileLayerRenderer}
       */
      const render = function(feature) {
        let styles;
        const styleFunction = feature.getStyleFunction() || layer.getStyleFunction();
        if (styleFunction) {
          styles = styleFunction(feature, resolution);
        }
        if (styles) {
          const dirty = this.renderFeature(feature, squaredTolerance, styles, builderGroup);
          this.dirty_ = this.dirty_ || dirty;
          builderState.dirty = builderState.dirty || dirty;
        }
      };

      const features = sourceTile.getFeatures();
      if (renderOrder && renderOrder !== builderState.renderedRenderOrder) {
        features.sort(renderOrder);
      }
      for (let i = 0, ii = features.length; i < ii; ++i) {
        const feature = features[i];
        if (reproject) {
          if (tileProjection.getUnits() == Units.TILE_PIXELS) {
            // projected tile extent
            tileProjection.setWorldExtent(sourceTileExtent);
            // tile extent in tile pixel space
            tileProjection.setExtent(sourceTile.getExtent());
          }
          feature.getGeometry().transform(tileProjection, projection);
        }
        if (!bufferedExtent || intersects(bufferedExtent, feature.getGeometry().getExtent())) {
          render.call(this, feature);
        }
      }
      const executorGroupInstructions = builderGroup.finish();
      // no need to clip when the render tile is covered by a single source tile
      const replayExtent = layer.getDeclutter() && sourceTiles.length === 1 ?
        null :
        sharedExtent;
      const renderingReplayGroup = new CanvasExecutorGroup(replayExtent, resolution,
        pixelRatio, source.getOverlaps(), this.declutterTree_, executorGroupInstructions, layer.getRenderBuffer());
      tile.executorGroups[layerUid].push(renderingReplayGroup);
    }
    builderState.renderedRevision = revision;
    builderState.renderedZ = tile.sourceZ;
    builderState.renderedRenderOrder = renderOrder;
  }

  /**
   * @inheritDoc
   */
  forEachFeatureAtCoordinate(coordinate, frameState, hitTolerance, callback, thisArg) {
    const resolution = frameState.viewState.resolution;
    const rotation = frameState.viewState.rotation;
    hitTolerance = hitTolerance == undefined ? 0 : hitTolerance;
    const layer = this.getLayer();
    const source = /** @type {import("../../source/VectorTile").default} */ (layer.getSource());
    const tileGrid = source.getTileGridForProjection(frameState.viewState.projection);
    /** @type {!Object<string, boolean>} */
    const features = {};

    const renderedTiles = /** @type {Array<import("../../VectorRenderTile.js").default>} */ (this.renderedTiles);

    let bufferedExtent, found;
    let i, ii;
    for (i = 0, ii = renderedTiles.length; i < ii; ++i) {
      const tile = renderedTiles[i];
      const tileExtent = tileGrid.getTileCoordExtent(tile.wrappedTileCoord);
      bufferedExtent = buffer(tileExtent, hitTolerance * resolution, bufferedExtent);
      if (!containsCoordinate(bufferedExtent, coordinate)) {
        continue;
      }
      const executorGroups = tile.executorGroups[getUid(layer)];
      for (let t = 0, tt = executorGroups.length; t < tt; ++t) {
        const executorGroup = executorGroups[t];
        found = found || executorGroup.forEachFeatureAtCoordinate(coordinate, resolution, rotation, hitTolerance, {},
          /**
           * @param {import("../../Feature.js").FeatureLike} feature Feature.
           * @return {?} Callback result.
           */
          function(feature) {
            const key = getUid(feature);
            if (!(key in features)) {
              features[key] = true;
              return callback.call(thisArg, feature, layer);
            }
          }, null);
      }
    }
    return found;
  }

  /**
   * @param {import("../../VectorTile.js").default} tile Tile.
   * @param {import("../../PluggableMap.js").FrameState} frameState Frame state.
   * @return {import("../../transform.js").Transform} transform Transform.
   * @private
   */
  getReplayTransform_(tile, frameState) {
    const layer = this.getLayer();
    const source = /** @type {import("../../source/VectorTile.js").default} */ (layer.getSource());
    const tileGrid = source.getTileGrid();
    const tileCoord = tile.tileCoord;
    const tileResolution = tileGrid.getResolution(tileCoord[0]);
    const viewState = frameState.viewState;
    const pixelRatio = frameState.pixelRatio;
    const renderResolution = viewState.resolution / pixelRatio;
    const tileExtent = tileGrid.getTileCoordExtent(tileCoord, this.tmpExtent);
    const center = viewState.center;
    const origin = getTopLeft(tileExtent);
    const size = frameState.size;
    const offsetX = Math.round(pixelRatio * size[0] / 2);
    const offsetY = Math.round(pixelRatio * size[1] / 2);
    return composeTransform(this.tmpTransform_,
      offsetX, offsetY,
      tileResolution / renderResolution, tileResolution / renderResolution,
      viewState.rotation,
      (origin[0] - center[0]) / tileResolution,
      (center[1] - origin[1]) / tileResolution);
  }

  /**
   * @param {import("../../events/Event.js").default} event Event.
   */
  handleFontsChanged_(event) {
    const layer = this.getLayer();
    if (layer.getVisible() && this.renderedLayerRevision_ !== undefined) {
      layer.changed();
    }
  }

  /**
   * Handle changes in image style state.
   * @param {import("../../events/Event.js").default} event Image style change event.
   * @private
   */
  handleStyleImageChange_(event) {
    this.renderIfReadyAndVisible();
  }

  /**
   * @inheritDoc
   */
  renderFrame(frameState, layerState) {
    super.renderFrame(frameState, layerState);

    const layer = /** @type {import("../../layer/VectorTile.js").default} */ (this.getLayer());
    const viewHints = frameState.viewHints;
    const hifi = !(viewHints[ViewHint.ANIMATING] || viewHints[ViewHint.INTERACTING]);
    const renderMode = layer.getRenderMode();
    if (renderMode === VectorTileRenderType.IMAGE) {
      this.renderTileImages_(hifi, frameState);
      return this.container_;
    }

    const context = this.overlayContext_;
    const declutterReplays = layer.getDeclutter() ? {} : null;
    const source = /** @type {import("../../source/VectorTile.js").default} */ (layer.getSource());
    const replayTypes = VECTOR_REPLAYS[renderMode];
    const pixelRatio = frameState.pixelRatio;
    const rotation = frameState.viewState.rotation;
    const size = frameState.size;

    // set forward and inverse pixel transforms
    makeScale(this.overlayPixelTransform_, 1 / pixelRatio, 1 / pixelRatio);
    makeInverse(this.inverseOverlayPixelTransform_, this.overlayPixelTransform_);

    // resize and clear
    const canvas = context.canvas;
    const width = Math.round(size[0] * pixelRatio);
    const height = Math.round(size[1] * pixelRatio);
    if (canvas.width != width || canvas.height != height) {
      canvas.width = width;
      canvas.height = height;
      const canvasTransform = transformToString(this.overlayPixelTransform_);
      if (canvas.style.transform !== canvasTransform) {
        canvas.style.transform = canvasTransform;
      }
    } else {
      context.clearRect(0, 0, width, height);
    }

    if (declutterReplays) {
      this.declutterTree_.clear();
    }
    const tiles = this.renderedTiles;
    const tileGrid = source.getTileGridForProjection(frameState.viewState.projection);
    const clips = [];
    for (let i = tiles.length - 1; i >= 0; --i) {
      const tile = /** @type {import("../../VectorRenderTile.js").default} */ (tiles[i]);
      if (tile.getState() == TileState.ABORT) {
        continue;
      }
      const tileCoord = tile.tileCoord;
      const tileExtent = tileGrid.getTileCoordExtent(tile.wrappedTileCoord);
      const worldOffset = tileGrid.getTileCoordExtent(tileCoord, this.tmpExtent)[0] - tileExtent[0];
      const transform = this.getRenderTransform(frameState, width, height, worldOffset);
      const executorGroups = tile.executorGroups[getUid(layer)];
      for (let t = 0, tt = executorGroups.length; t < tt; ++t) {
        const executorGroup = executorGroups[t];
        if (!executorGroup.hasExecutors(replayTypes)) {
          // sourceTile was not yet loaded when this.createReplayGroup_() was
          // called, or it has no replays of the types we want to render
          continue;
        }
        const currentZ = tile.tileCoord[0];
        let zs, currentClip;
        if (!declutterReplays) {
          zs = [];
          currentClip = executorGroup.getClipCoords(transform);
          context.save();

          // Create a clip mask for regions in this low resolution tile that are
          // already filled by a higher resolution tile
          for (let j = 0, jj = clips.length; j < jj; ++j) {
            const clip = clips[j];
            if (currentZ < zs[j]) {
              context.beginPath();
              // counter-clockwise (outer ring) for current tile
              context.moveTo(currentClip[0], currentClip[1]);
              context.lineTo(currentClip[2], currentClip[3]);
              context.lineTo(currentClip[4], currentClip[5]);
              context.lineTo(currentClip[6], currentClip[7]);
              // clockwise (inner ring) for higher resolution tile
              context.moveTo(clip[6], clip[7]);
              context.lineTo(clip[4], clip[5]);
              context.lineTo(clip[2], clip[3]);
              context.lineTo(clip[0], clip[1]);
              context.clip();
            }
          }
        }
        executorGroup.execute(context, transform, rotation, {}, hifi, replayTypes, declutterReplays);
        if (!declutterReplays) {
          context.restore();
          clips.push(currentClip);
          zs.push(currentZ);
        }
      }
    }
    if (declutterReplays) {
      replayDeclutter(declutterReplays, context, rotation, hifi);
    }

    const opacity = layerState.opacity;
    if (opacity !== parseFloat(canvas.style.opacity)) {
      canvas.style.opacity = opacity;
    }

    // Now that we have rendered the tiles we have already, let's prepare new tile images
    // for the next frame
    this.renderTileImages_(hifi, frameState);

    return this.container_;
  }

  /**
   * @param {boolean} hifi We have time to render a high fidelity map image.
   * @param {import('../../PluggableMap.js').FrameState} frameState Frame state.
   */
  renderTileImages_(hifi, frameState) {
    // When we don't have time to render hifi, only render tiles until we have used up
    // half of the frame budget of 16 ms
    for (const uid in this.renderTileImageQueue_) {
      if (!hifi && Date.now() - frameState.time > 8) {
        break;
      }
      const tile = this.renderTileImageQueue_[uid];
      frameState.animate = true;
      delete this.renderTileImageQueue_[uid];
      this.renderTileImage_(tile, frameState.pixelRatio, frameState.viewState.projection);
    }
    if (!isEmpty(this.renderTileImageQueue_)) {
      // If there's items left in the queue, render them in another frame
      frameState.animate = true;
    }
  }

  /**
   * @param {import("../../Feature.js").FeatureLike} feature Feature.
   * @param {number} squaredTolerance Squared tolerance.
   * @param {import("../../style/Style.js").default|Array<import("../../style/Style.js").default>} styles The style or array of styles.
   * @param {import("../../render/canvas/BuilderGroup.js").default} executorGroup Replay group.
   * @return {boolean} `true` if an image is loading.
   */
  renderFeature(feature, squaredTolerance, styles, executorGroup) {
    if (!styles) {
      return false;
    }
    let loading = false;
    if (Array.isArray(styles)) {
      for (let i = 0, ii = styles.length; i < ii; ++i) {
        loading = renderFeature(
          executorGroup, feature, styles[i], squaredTolerance,
          this.handleStyleImageChange_, this) || loading;
      }
    } else {
      loading = renderFeature(
        executorGroup, feature, styles, squaredTolerance,
        this.handleStyleImageChange_, this);
    }
    return loading;
  }

  /**
   * @param {import("../../VectorRenderTile.js").default} tile Tile.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../../proj/Projection.js").default} projection Projection.
   * @return {boolean} A new tile image was rendered.
   * @private
   */
  tileImageNeedsRender_(tile, pixelRatio, projection) {
    const layer = /** @type {import("../../layer/VectorTile.js").default} */ (this.getLayer());
    const replayState = tile.getReplayState(layer);
    const revision = layer.getRevision();
    const sourceZ = tile.sourceZ;
    return replayState.renderedTileRevision !== revision || replayState.renderedTileZ !== sourceZ;
  }

  /**
   * @param {import("../../VectorRenderTile.js").default} tile Tile.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../../proj/Projection.js").default} projection Projection.
   * @private
   */
  renderTileImage_(tile, pixelRatio, projection) {
    const layer = /** @type {import("../../layer/VectorTile.js").default} */ (this.getLayer());
    const replayState = tile.getReplayState(layer);
    const revision = layer.getRevision();
    const executorGroups = tile.executorGroups[getUid(layer)];
    replayState.renderedTileRevision = revision;
    replayState.renderedTileZ = tile.sourceZ;
    const tileCoord = tile.wrappedTileCoord;
    const z = tileCoord[0];
    const source = /** @type {import("../../source/VectorTile.js").default} */ (layer.getSource());
    const tileGrid = source.getTileGridForProjection(projection);
    const resolution = tileGrid.getResolution(z);
    const context = tile.getContext(layer);
    const size = source.getTilePixelSize(z, pixelRatio, projection);
    context.canvas.width = size[0];
    context.canvas.height = size[1];
    const tileExtent = tileGrid.getTileCoordExtent(tileCoord, this.tmpExtent);
    for (let i = 0, ii = executorGroups.length; i < ii; ++i) {
      const executorGroup = executorGroups[i];
      const pixelScale = pixelRatio / resolution;
      const transform = resetTransform(this.tmpTransform_);
      scaleTransform(transform, pixelScale, -pixelScale);
      translateTransform(transform, -tileExtent[0], -tileExtent[3]);
      executorGroup.execute(context, transform, 0, {}, true, IMAGE_REPLAYS[layer.getRenderMode()]);
    }
  }

  /**
   * @inheritDoc
   */
  getDataAtPixel(pixel, frameState, hitTolerance) {
    let data = super.getDataAtPixel(pixel, frameState, hitTolerance);
    if (data) {
      return data;
    }

    const renderPixel = applyTransform(this.inverseOverlayPixelTransform_, pixel.slice());
    const context = this.overlayContext_;

    try {
      data = context.getImageData(Math.round(renderPixel[0]), Math.round(renderPixel[1]), 1, 1).data;
    } catch (err) {
      if (err.name === 'SecurityError') {
        // tainted canvas, we assume there is data at the given pixel (although there might not be)
        return new Uint8Array();
      }
      return data;
    }

    if (data[3] === 0) {
      return null;
    }
    return data;
  }

}


export default CanvasVectorTileLayerRenderer;
