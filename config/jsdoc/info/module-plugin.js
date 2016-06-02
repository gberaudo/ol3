var moduleMatcher = /goog\.(module)\('(.*)'\)/;

var currentModule;

exports.handlers = {
  beforeParse: function(e) {
    var lines = String(e.source).split('\n');
    for (var i = 0, ii = lines.length; i < ii; i++) {
      var line = lines[i];
      var match = line.match(moduleMatcher);
      if (match) {
        currentModule = match[2];
        return;
      }
    }
    currentModule = null;
  },
  newDoclet: function(e) {
    var doclet = e.doclet;
    if (currentModule && (typeof doclet.api === 'string')) {
      // Doclets in modules are messed up due to jsdoc trying to handle
      // assignments to 'exports' or properties from 'exports'.
      doclet.module = currentModule;
      if (!doclet.longname) {
        // module constructor
        doclet.longname = currentModule;
        doclet.name = currentModule;
      } else if (doclet.name === doclet.longname) {
        // module constructor method
        if(doclet.name[0] !== '#') {
          if (doclet.kind === 'function') {
            // case ol.color.asArray
            doclet.name = '.' + doclet.name;
          } else {
            // member
            // case of ol.CollectionEvent#element
            doclet.name = '#' + doclet.name;
          }
        }
        if (typeof doclet.memberof !== undefined) {
          doclet.memberof = doclet.module;
        }
        doclet.longname = doclet.module + doclet.name;
      }
    }
  }
};
