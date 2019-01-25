const path = require('path');
module.exports = {
  entry: './src/ol/worker/worker.js',
  devtool: 'source-map',
  mode: 'development',
  output: {
    sourcePrefix: '\t',
    path: path.resolve('./build/worker'),
    filename: 'hash.webpack.worker.js',
    //libraryTarget: 'umd',
    libraryExport: 'default'
  }
};
