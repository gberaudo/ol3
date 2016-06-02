for d in `find test_doclets -mindepth 1 -maxdepth 1 -type d`;
do
  node_modules/.bin/jsdoc -c config/jsdoc/info/conf.json $d/module -X > $d/module/result_x
  node_modules/.bin/jsdoc -c config/jsdoc/info/conf.json $d/provide -X > $d/provide/result_x

  node_modules/.bin/jsdoc -c config/jsdoc/info/conf.json $d/module | sed 's/^.*"path": .*$//g' > $d/module/result
  node_modules/.bin/jsdoc -c config/jsdoc/info/conf.json $d/provide | sed 's/^.*"path": .*$//g' > $d/provide/result
done
