import MVT from '../format/MVT';
import VectorTileLayer from '../layer/VectorTile.js';
import VectorTileSource from '../source/VectorTile.js';
import {Fill, Icon, Stroke, Style, Text} from '../style.js';
import {createMapboxStreetsV6Style} from './mapbox-streets-v6-style.js';
import {get as getProjection} from '../proj.js';

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
const frameState = JSON.parse('{"animate":false,"coordinateToPixelTransform":[null,null,null,-1.6745810619749533,22805493,10118527],"extent":[null,null,null,6042422.925807185],"focus":[null,null],"index":978,"layerStates":{"2":null},"layerStatesArray":[null],"pixelRatio":1,"pixelToCoordinateTransform":[null,null,null,-0.5971642834779395,-13618625.886706166,6042422.925807185],"postRenderFunctions":[],"size":[null,null],"skippedFeatureUids":{},"tileQueue":{"elements_":[],"priorities_":[],"queuedElements_":{},"tilesLoading_":0,"tilesLoadingKeys_":{}},"time":1544698859280,"usedTiles":{},"viewState":{"center":[null,null],"projection":{"code_":"EPSG:3857","units_":"m","extent_":[null,null,null,20037508.342789244],"worldExtent_":[null,null,null,85],"axisOrientation_":"enu","global_":true,"canWrapX_":true,"defaultTileGrid_":null},"resolution":0.5971642834779395,"rotation":0,"zoom":18},"viewHints":[null,null],"wantedTiles":{}}');
frameState.viewState.projection = getProjection('EPSG:3857');

// JSON.stringify(layerState, (key, value) => key === 'layer' ? null : value)
const layerState = JSON.parse('{"layer":null,"managed":true,"opacity":1,"sourceState":"ready","visible":true,"zIndex":0,"maxResolution":null,"minResolution":0}');
layerState.layer = layer;
renderer.prepareFrame(frameState, layerState);
renderer.renderFrame(frameState, layerState);

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
