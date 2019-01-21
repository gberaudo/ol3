import Map from '../src/ol/Map.js';
import View from '../src/ol/View.js';
import MVT from '../src/ol/format/MVT.js';
import VectorTileLayer from '../src/ol/layer/VectorTile.js';
import VectorTileSource from '../src/ol/source/VectorTile.js';
import {Style, Fill, Stroke, Icon, Text} from '../src/ol/style.js';
import {createMapboxStreetsV6Style} from '../src/ol/worker/mapbox-streets-v6-style.js';


// eslint-disable-next-line
// @ts-ignore import/no-unresolved

const key = 'pk.eyJ1IjoiYWhvY2V2YXIiLCJhIjoiRk1kMWZaSSJ9.E5BkluenyWQMsBLsuByrmg';

const MyWorker = require('worker-loader?name=my_mvt_worker.js!../src/ol/worker/worker.js');
const useWorker = true;

const map = new Map({
  layers: [
    new VectorTileLayer({
      worker: useWorker ? new MyWorker() : null,
      renderMode: 'image',
      declutter: true,
      useInterimTilesOnError: true,
      source: new VectorTileSource({
        attributions: '© <a href="https://www.mapbox.com/map-feedback/">Mapbox</a> ' +
          '© <a href="https://www.openstreetmap.org/copyright">' +
          'OpenStreetMap contributors</a>',
        format: new MVT(),
        url: 'https://{a-d}.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/' +
            '{z}/{x}/{y}.vector.pbf?access_token=' + key
      }),
      style: useWorker ? null : createMapboxStreetsV6Style(Style, Fill, Stroke, Icon, Text)
    })
  ],
  target: 'map',
  view: new View({
    center: [260088, 6248909],
    zoom: 14
  })
});
