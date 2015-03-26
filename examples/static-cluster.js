goog.require('ol.Feature');
goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.interaction.Select');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.source.GeoJSON');
goog.require('ol.source.MapQuest');
goog.require('ol.source.StaticCluster');
goog.require('ol.style.Circle');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');
goog.require('ol.style.Text');

var source = new ol.source.GeoJSON({
  url: 'data/dump_geojson_bus_fragments.json',
  projection: 'EPSG:3857'
});

var clusterSource = new ol.source.StaticCluster({
  distance: 40,
  source: source
});

var styleCache = {};
var clusters = new ol.layer.Vector({
  source: clusterSource,
  style: function(feature, resolution) {
    var size = feature.get('features').length;
    var style = styleCache[size];
    if (!style) {
      style = [new ol.style.Style({
        image: new ol.style.Circle({
          radius: 10,
          stroke: new ol.style.Stroke({
            color: '#fff'
          }),
          fill: new ol.style.Fill({
            color: '#3399CC'
          })
        }),
        text: new ol.style.Text({
          text: size.toString(),
          fill: new ol.style.Fill({
            color: '#fff'
          })
        })
      })];
      styleCache[size] = style;
    }
    return style;
  }
});

var raster = new ol.layer.Tile({
  source: new ol.source.MapQuest({layer: 'sat'})
});


var map = new ol.Map({
  layers: [raster, clusters],
  renderer: 'canvas',
  target: 'map',
  view: new ol.View({
    center: [0, 0],
    zoom: 2
  })
});

var select = new ol.interaction.Select();
map.addInteraction(select);
select.on('select', function(e) {
    var features = e.target.getFeatures();
    console.log('Selected', features.getLength());
    var hierarchy = function(feature) {
      var hiddenFeatures = feature.get('features');
      if (!hiddenFeatures || hiddenFeatures.length == 1) {
        return feature.getId();
      } else {
        return hiddenFeatures.map(hierarchy);
      }
    };
    features.forEach(function(feature) {
      var hiddenFeatures = feature.get('features');
      console.log('Hidding', hiddenFeatures.length, hierarchy(feature));
    });
});

