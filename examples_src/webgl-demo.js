goog.require('ol.Feature');
goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.format.GeoJSON');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.source.MapQuest');
goog.require('ol.source.Vector');
goog.require('ol.style.Circle');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');



// Polygons
var createPolygonStyleFunction = function() {
  return function(feature, resolution) {
    var style = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'blue',
        width: 1
      }),
      fill: new ol.style.Fill({
        color: 'rgba(0, 0, 255, 0.1)'
      })
    });
    return [style];
  };
};

var vectorPolygons = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'data/geojson/polygon-samples.geojson',
    format: new ol.format.GeoJSON()
  }),
  style: createPolygonStyleFunction()
});


// Lines
var createLineStyleFunction = function() {
  return function(feature, resolution) {
    var style = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'green',
        width: 2
      })
    });
    return [style];
  };
};

var vectorLines = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'data/geojson/line-samples.geojson',
    format: new ol.format.GeoJSON()
  }),
  style: createLineStyleFunction()
});


// Points
var createPointStyleFunction = function() {
  return function(feature, resolution) {
    var style = new ol.style.Style({
      image: new ol.style.Circle({
        radius: 10,
        fill: new ol.style.Fill({color: 'rgba(255, 0, 0, 0.1)'}),
        stroke: new ol.style.Stroke({color: 'red', width: 1})
      })
    });
    return [style];
  };
};

var vectorPoints = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'data/geojson/point-samples.geojson',
    format: new ol.format.GeoJSON()
  }),
  style: createPointStyleFunction()
});

var map = new ol.Map({
  layers: [
    new ol.layer.Tile({
      source: new ol.source.MapQuest({layer: 'osm'})
    }),
    vectorPolygons,
    vectorLines,
    vectorPoints
  ],
  target: 'map',
  renderer: exampleNS.getRendererFromQueryString(),
  view: new ol.View({
    center: [-8161939, 6095025],
    zoom: 8
  })
});

$('#refresh-points').click(function() {
  vectorPoints.setStyle(createPointStyleFunction());
});

$('#refresh-lines').click(function() {
  vectorLines.setStyle(createLineStyleFunction());
});

$('#refresh-polygons').click(function() {
  vectorPolygons.setStyle(createPolygonStyleFunction());
});
