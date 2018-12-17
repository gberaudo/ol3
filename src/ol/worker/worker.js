import MVT from '../format/MVT';
import VectorTileLayer from '../layer/VectorTile.js';
import VectorTileSource from '../source/VectorTile.js';
import {Fill, Icon, Stroke, Style, Text} from '../style.js';
import {createMapboxStreetsV6Style} from './mapbox-streets-v6-style.js';
import {get as getProjection} from '../proj.js';
import TileQueue from '../TileQueue.js';

import {getUid} from '../util.js';
import ContextEventType from '../webgl/ContextEventType';

const key = 'pk.eyJ1IjoiYWhvY2V2YXIiLCJhIjoiRk1kMWZaSSJ9.E5BkluenyWQMsBLsuByrmg';

const layer = new VectorTileLayer({
  declutter: true,
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
const renderer = layer.createRenderer();
// JSON.stringify(frameState, (key, value) => key in ['layerStates', 'tileQueue', 'tileCache'] ? null : (console.log('..', key, value), value))
// JSON.stringify(Object.assign({}, frameState, {layerStates: {}, layerStatesArray: [], tileQueue: null, tileCache: {}}))
const frameState = JSON.parse('{"animate":false,"coordinateToPixelTransform":[0.00002555207919273305,0,0,-0.00002555207919273305,822.5,200],"extent":[-32189161.351453424,-7827151.696402049,32189161.351453424,7827151.696402049],"focus":[0,0],"index":0,"layerStates":{},"layerStatesArray":[],"pixelRatio":1.100000023841858,"pixelToCoordinateTransform":[39135.75848201024,0,0,-39135.75848201024,-32189161.351453424,7827151.696402049],"postRenderFunctions":[],"size":[1645,400],"skippedFeatureUids":{},"tileQueue":null,"time":1545052897213,"usedTiles":{},"viewState":{"center":[0,0],"projection":{"code_":"EPSG:3857","units_":"m","extent_":[-20037508.342789244,-20037508.342789244,20037508.342789244,20037508.342789244],"worldExtent_":[-180,-85,180,85],"axisOrientation_":"enu","global_":true,"canWrapX_":true,"defaultTileGrid_":null},"resolution":39135.75848201024,"rotation":0,"zoom":2},"viewHints":[0,0],"wantedTiles":{},"tileCache":{}}');
const tileQueue = new TileQueue(() => 10, () => {});
frameState.tileQueue = tileQueue;
frameState.viewState.projection = getProjection('EPSG:3857');

// JSON.stringify(layerState, (key, value) => key === 'layer' ? null : value)
const layerState = JSON.parse('{"layer":null,"managed":true,"opacity":1,"sourceState":"ready","visible":true,"zIndex":0,"maxResolution":null,"minResolution":0}');
layerState.layer = layer;

frameState.layerStates = {
  [getUid(layer)]: layerState
};

frameState.layerStatesArray = [
  layerState
];

setInterval(function() {
  frameState.time = Date.now();
  frameState.index++;
  renderer.prepareFrame(frameState, layerState);
  /** @type {*} */
  const [baseCanvas, overlayCanvas] = renderer.renderFrame(frameState, layerState);
  // const ctx = overlayCanvas.getContext('2d');
  // //j = ++j % 150;
  // //i = ++i % 40;
  // //ctx.fillStyle = 'rgb(' + Math.floor(255 - 10 * i) + ',' + Math.floor(255 - j) + ',0)';
  // ctx.save();
  // ctx.fillStyle = 'red';
  // ctx.rect(-1000, -120, 10, 10);
  // // ctx.lineWidth = 0/;
  // ctx.fill();
  // ctx.stroke();
  // ctx.restore();
  tileQueue.loadMoreTiles(50, 50);
  /** @type {Array<Transferable>} */
  const baseImage = baseCanvas['transferToImageBitmap']();
  const overlayImage = overlayCanvas['transferToImageBitmap']();
  self.postMessage({
    baseImage,
    overlayImage
  }, [baseImage, overlayImage]);
}, 160);


self.onmessage = function(event) {
  console.log('Received event in worker', event.data);
//   if (event.data.action === 'load') {
//     const url = event.data.url;
//     loadFeaturesXhr(url, format, (features) => {
//       self.postMessage({
//         what: 'features',
//         url,
//         features,
//         projection: format.readProjection(),
//         extent: format.getLastExtent()
//       });
//     }, () => {
//       self.postMessage({
//         what: 'error',
//         url
//       });
//     })();
//   }
};
