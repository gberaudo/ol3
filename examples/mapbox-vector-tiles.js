import Map from '../src/ol/Map.js';
import View from '../src/ol/View.js';
import MVT from '../src/ol/format/MVT.js';
import VectorTileLayer from '../src/ol/layer/VectorTile.js';
import VectorTileSource from '../src/ol/source/VectorTile.js';

// eslint-disable-next-line
// @ts-ignore import/no-unresolved


const key = 'pk.eyJ1IjoiYWhvY2V2YXIiLCJhIjoiRk1kMWZaSSJ9.E5BkluenyWQMsBLsuByrmg';


const MyWorker = require('worker-loader?name=my_mvt_worker.js!../src/ol/worker/worker.js');
const worker = new MyWorker();

const map = new Map({
  layers: [
    new VectorTileLayer({
      worker: worker,
      declutter: true,
      useInterimTilesOnError: false,
      source: new VectorTileSource({
        attributions: '© <a href="https://www.mapbox.com/map-feedback/">Mapbox</a> ' +
          '© <a href="https://www.openstreetmap.org/copyright">' +
          'OpenStreetMap contributors</a>',
        format: new MVT(),
        url: 'https://{a-d}.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/' +
            '{z}/{x}/{y}.vector.pbf?access_token=' + key
      }),
      style: function() {return null;} // unused
    })
  ],
  target: 'map',
  view: new View({
    center: [730737.990406, 5874032.749659],
    zoom: 17
  })
});

// setInterval(function() {
//   map.render(); // FIXME: force rendering
// }, 10);
