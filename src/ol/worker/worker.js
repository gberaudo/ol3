import MVT from '../format/MVT';
import VectorTileLayer from '../layer/VectorTile.js';
import VectorTileSource from '../source/VectorTile.js';
import {createMapboxStreetsV6Style} from './mapbox-streets-v6-style.js';
import {get as getProjection} from '../proj.js';
import {Style, Fill, Stroke, Icon, Text} from '../style';
import {continueWorkerImageLoading} from '../loadImage';
import TileState from '../TileState';
import TileGrid from '../tilegrid/TileGrid';

const key = 'pk.eyJ1IjoiYWhvY2V2YXIiLCJhIjoiRk1kMWZaSSJ9.E5BkluenyWQMsBLsuByrmg';

const layer = new VectorTileLayer({
  declutter: false,
  useInterimTilesOnError: false,
  renderMode: 'image',
  source: new VectorTileSource({
    attributions: '© <a href="https://www.mapbox.com/map-feedback/">Mapbox</a> ' +
      '© <a href="https://www.openstreetmap.org/copyright">' +
      'OpenStreetMap contributors</a>',
    format: new MVT(),
    url: 'https://{a-d}.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/' +
        '{z}/{x}/{y}.vector.pbf?access_token=' + key
  }),
  style: createMapboxStreetsV6Style(Style, Fill, Stroke, Icon, Text)
});


const renderer = /** @type {CanvasVectorTileLayerRenderer} */ (layer.createRenderer());
const epsg3857 = getProjection('EPSG:3857');


/**
 * @param {number} messageId An opaque id from the main thread.
 * @param {VectorRenderTile} tile The rendered tile.
 */
function success(messageId, tileId, tile) {
  // Executors are not yet serializable.
  // So we render up-to a transferable canvas for now.
  const executorGroup = [];
  const bitmap = renderer.getTileImage(tile)['transferToImageBitmap']();

  self.postMessage({
    action: 'preparedTile',
    messageId: messageId,
    tileId: tileId,
    images: [bitmap],
    executorGroup: executorGroup
  }, [bitmap]);
}

function failure(messageId, tileId, tile) {
  self.postMessage({
    action: 'failedTilePreparation',
    state: tile.getState(),
    messageId: messageId,
    tileId: tileId
  });
}

self.onmessage = function(event) {
  console.log('Received event in worker', event.data);
  const action = event.data.action;
  if (action === 'prepareTile') {
    const {messageId, tileId, tileCoord, pixelRatio} = event.data;
    const [z, x, y] = tileCoord;
    renderer.prepareTileInWorker(z, x, y, pixelRatio, epsg3857, tileId).then(
      success.bind(null, messageId, tileId),
      failure.bind(null, messageId, tileId)
    );
  } else if (action === 'continueWorkerImageLoading') {
    const {opaqueId, image} = event.data;
    continueWorkerImageLoading(opaqueId, image);
  }
};
