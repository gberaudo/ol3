import Map from '../src/ol/Map.js';
import View from '../src/ol/View.js';
import {Image as ImageLayer, Tile as TileLayer} from '../src/ol/layer.js';
import Projection from '../src/ol/proj/Projection.js';
import ImageWMS from '../src/ol/source/ImageWMS.js';
import TileWMS from '../src/ol/source/TileWMS.js';
import {TileDebug} from '../src/ol/source.js';
import {createXYZ} from '../src/ol/tilegrid.js';
import VectorTileLayer from '../src/ol/layer/VectorTile.js';
import VectorTileSource from '../src/ol/source/VectorTile.js';
import MVT from '../src/ol/format/MVT.js';


const routesMVTLayer = new VectorTileLayer({
  source: new VectorTileSource({
    attributions: '© the guys',
    //projection: 'EPSG:21781',
    format: new MVT(),
    url: 'http://localhost:8000/mvt/21781/{z}/{x}/{y}.pbf',
    maxZoom: 14
  }),
});


const layers = [
  new TileLayer({
    source: new TileWMS({
      attributions: '© <a href="http://www.geo.admin.ch/internet/geoportal/' +
          'en/home.html">Pixelmap 1:1000000 / geo.admin.ch</a>',
      crossOrigin: 'anonymous',
      params: {
        'LAYERS': 'ch.swisstopo.pixelkarte-farbe-pk1000.noscale',
        'FORMAT': 'image/jpeg'
      },
      url: 'https://wms.geo.admin.ch/'
    })
  }),
  new ImageLayer({
    source: new ImageWMS({
      attributions: '© <a href="http://www.geo.admin.ch/internet/geoportal/' +
          'en/home.html">National parks / geo.admin.ch</a>',
      crossOrigin: 'anonymous',
      params: {'LAYERS': 'ch.bafu.schutzgebiete-paerke_nationaler_bedeutung'},
      serverType: 'mapserver',
      url: 'https://wms.geo.admin.ch/'
    })
  }),
  routesMVTLayer,
  new TileLayer({
    source: new TileDebug({
      tileGrid: routesMVTLayer.getSource().getTileGrid()
    })
  })
];

// A minimal projection object is configured with only the SRS code and the map
// units. No client-side coordinate transforms are possible with such a
// projection object. Requesting tiles only needs the code together with a
// tile grid of Cartesian coordinates; it does not matter how those
// coordinates relate to latitude or longitude.
const projection = new Projection({
  code: 'EPSG:21781',
  units: 'm'
});

const map = new Map({
  layers: layers,
  target: 'map',
  view: new View({
    center: [660000, 190000],
    projection: projection,
    zoom: 9
  })
});


