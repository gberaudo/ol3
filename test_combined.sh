#!/bin/bash

# make cleanall
# rm -rf node_modules
# npm install

> combined_results
for i in examples/*.html
do
  echo Testing example $i
  key="`basename -s .html $i`"
  grep -q NOCOMPILE examples/$key.js && continue

  make build/compiled-examples/$key.json
  node tasks/build.js build/compiled-examples/$key.json build/compiled-examples/$key.combined.js 2> >(tee stderr.log >&2)
  echo "$? $key examples/$key.js" >> combined_results
  cat stderr.log >> combined_results
done
rm stderr.log
