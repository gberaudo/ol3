#!/bin/bash
# Check with jparse
# with once as (select ST_Transform(ST_GeomFromText('POINT(8.238660646 46.865041595)',4326),21781) as target) select ST_AsGeoJSON(ST_Transform(geom, 4326)), id, category_station FROM station,once where category_station = 'bus' and ST_Distance(geom, once.target) < 5000 limit 10;

filein=$1
fileout=$1.json

echo '{"type":"FeatureCollection", "features": [' > $fileout
while read p
do
  geom=`echo $p | cut -d\|  -f 1 | sed 's/ //g'`
  id=`echo $p | cut -d\|  -f 2 | sed 's/ //g'`
  kind=`echo $p | cut -d\|  -f 3 | sed 's/ //g'`
  if [ "$p" ];
  then
    echo "{\"geometry\": $geom, \"type\":\"Feature\", \"properties\": {\"kind\":\"$kind\"}, \"id\":$id}," >> $fileout
    echo -n "."
  fi
done < $filein
sed -i '$s/.$//' $fileout
echo ']}' >> $fileout
