import MVT from '../format/MVT';
import VectorTileLayer from '../layer/VectorTile.js';
import VectorTileSource from '../source/VectorTile.js';
import {createMapboxStreetsV6Style} from './mapbox-streets-v6-style.js';
import {get as getProjection} from '../proj.js';
import {Style, Fill, Stroke, Icon, Text} from '../style';
import {continueWorkerImageLoading} from '../loadImage';

const key = 'pk.eyJ1IjoiYWhvY2V2YXIiLCJhIjoiRk1kMWZaSSJ9.E5BkluenyWQMsBLsuByrmg';

const layer = new VectorTileLayer({
  declutter: true,
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
function success(messageId, tile) {
  // Executors are not yet serializable.
  // So we render up-to a transferable canvas for now.
  const executors = {};
  const bitmap = renderer.getTileImage(tile)['transferToImageBitmap']();

  self.postMessage({
    action: 'preparedTile',
    messageId: messageId,
    images: [bitmap],
    executors: executors
  }, [bitmap]);
}

function failure(messageId, tile) {
  self.postMessage({
    action: 'failedTilePreparation',
    state: tile.getState(),
    messageId: messageId
  });
}

self.onmessage = function(event) {
  console.log('Received event in worker', event.data);
  const action = event.data.action;
  if (action === 'prepareTile') {
    const {messageId, tileCoord, pixelRatio} = event.data;
    const [z, x, y] = tileCoord;
    renderer.prepareTileInWorker(z, x, y, pixelRatio, epsg3857, messageId).then(
      success.bind(null, messageId),
      failure.bind(null, messageId)
    );
  } else if (action === 'continueWorkerImageLoading') {
    const {opaqueId, image} = event.data;
    continueWorkerImageLoading(opaqueId, image);
  }
};
