import Map from '../src/ol/Map.js';
import View from '../src/ol/View.js';
import MVT from '../src/ol/format/MVT.js';
import VectorTileLayer from '../src/ol/layer/VectorTile.js';
import VectorTileSource from '../src/ol/source/VectorTile.js';
import {Fill, Icon, Stroke, Style, Text} from '../src/ol/style.js';

//import OLWorker from '../src/ol/worker/export.js';
//const blob = new Blob([OLWorker], {type: 'application/javascript'});
//const worker = new Worker(URL.createObjectURL(blob));

// eslint-disable-next-line
// @ts-ignore import/no-unresolved
const MyWorker = require('worker-loader?name=my_mvt_worker.js!../src/ol/worker/worker.js');
const worker = new MyWorker();

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
  canvas.getContext("bitmaprenderer").transferFromImageBitmap(img);
  img.close();
}

function drawImage(canvas, img) {
  // Less efficient method (copy)
  resizeCanvas(canvas, img);
  canvas.getContext("2d").drawImage(img, 0, 0);
  img.close();
}

function receiveMessage(event) {
  const {baseImage, overlayImage} = event.data;
  const baseCanvas = document.getElementById('canvasbase');
  const overlayCanvas = document.getElementById('canvasoverlay');
  drawImage(baseCanvas, baseImage);
  pushImage(overlayCanvas, overlayImage);
}
worker.addEventListener("message", receiveMessage, false);

// const key = 'pk.eyJ1IjoiYWhvY2V2YXIiLCJhIjoiRk1kMWZaSSJ9.E5BkluenyWQMsBLsuByrmg';

// const map = new Map({
//   layers: [
//     new VectorTileLayer({
//       declutter: true,
//       source: new VectorTileSource({
//         tileLoadFunction: workerfeatureloader,
//         attributions: '© <a href="https://www.mapbox.com/map-feedback/">Mapbox</a> ' +
//           '© <a href="https://www.openstreetmap.org/copyright">' +
//           'OpenStreetMap contributors</a>',
//         format: new MVT(),
//         url: 'https://{a-d}.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/' +
//             '{z}/{x}/{y}.vector.pbf?access_token=' + key
//       }),
//       style: createMapboxStreetsV6Style(Style, Fill, Stroke, Icon, Text)
//     })
//   ],
//   target: 'map',
//   view: new View({
//     center: [0, 0],
//     zoom: 2
//   })
// });


