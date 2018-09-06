exports.handlers = {
  newDoclet: function(e) {
    const d = e.doclet;
    if (d.meta.code && d.meta.code.name) {
      const codeName = d.meta.code.name;
      if (codeName === 'module.exports') {
        // Found a default export
        // The doclet is rewritten to look like a class declaration
        const lastSlashIndex = d.name.lastIndexOf('/');
        const symbolName = d.name.substring(lastSlashIndex + 1);
        d.name = symbolName;
        d.memberof = d.longname;
        d.params = [];
        d.classdesc = "fake class";
        d.longname += '~' + symbolName;
        d.kind = 'class';
        d.api = true;
        delete d.undocumented;
      } else if (codeName.startsWith('exports.')) {
        // Found a named export
        d.api = true;
      }
    }
  }
};
