# o5m-decode

streaming parser for o5m files

# example

```
var to = require('to2')
var decode = require('o5m-decode')()
process.stdin.pipe(decode).pipe(to.obj(write))

function write (row, enc, next) {
  console.log(row)
  next()
}
```

# api

``` js
var decode = require('o5m-decode')
```

## var d = decode()

Return a transform stream `d` that turns o5m file content as input into objects
of output. Each has a `row.type` field:

* bbox
* node
* way
* relation

### bbox

Each bbox object has:

* `row.x1` - west (degrees longitude)
* `row.y1` - south (degrees latitude)
* `row.x2` - east (degrees longitude)
* `row.y2` - north (degrees latitude)

For example:

``` js
{ type: 'bbox',
  x1: 174.875,
  y1: -36.7495926,
  x2: 175,
  y2: -36.6246952 }
```

### node

Each node object has:

* `row.id` - integer unique id
* `row.version` - integer document version
* `row.timestamp` - integer unix epoch timestamp
* `row.changeset` - integer id of changeset
* `row.uid` - integer user id
* `row.user` - string user name
* `row.longitude` - floating point longitude degrees
* `row.latitude` - floating point latitude degrees
* `row.tags` - object mapping tag keys to strings

For example:

``` js
{ type: 'node',
  id: 3246777679,
  version: 1,
  timestamp: 1419192559,
  changeset: 27617118,
  uid: 33589,
  user: 'zenfunk',
  longitude: 174.9457338,
  latitude: -36.7353312,
  tags: 
   { 'seamark:type': 'beacon_lateral',
     'seamark:topmark:shape': 'cylinder',
     'seamark:topmark:colour': 'red',
     'seamark:beacon_lateral:colour': 'red',
     'seamark:beacon_lateral:system': 'iala-a',
     'seamark:beacon_lateral:category': 'port' } }
```

### way

Each way object has:

* `row.id` - integer unique id
* `row.version` - integer document version
* `row.timestamp` - integer unix epoch timestamp
* `row.changeset` - integer id of changeset
* `row.uid` - integer user id
* `row.user` - string user name
* `row.refs` - array of id integers that belong to this way

For example:

``` js
{ type: 'way',
  refs: 
   [ 2007896270,
     2007896278,
     2007896284,
     2007896298,
     2007896302,
     2007896301,
     2007896291,
     2007896278,
     2007896261,
     2007896264,
     2007896274 ],
  id: 190187715,
  version: 1,
  timestamp: 1352626100,
  changeset: 13830035,
  uid: 833786,
  user: 'barnaclebarnes_linz',
  tags: 
   { is_in: 'David Rocks (The Four Islands)',
     natural: 'coastline',
     'LINZ:layer': 'island_poly',
     source_ref: 'http://www.linz.govt.nz/topography/topo-maps/',
     attribution: 'http://wiki.osm.org/wiki/Attribution#LINZ',
     'LINZ:dataset': 'mainland',
     'LINZ:group_name': 'David Rocks (The Four Islands)',
     'LINZ:source_version': '2012-06-06' } }
```

### relation

Each relation object has:

* `row.id` - integer unique id
* `row.version` - integer document version
* `row.timestamp` - integer unix epoch timestamp
* `row.changeset` - integer id of changeset
* `row.uid` - integer user id
* `row.user` - string user name
* `row.members` - array of objects with `id`, `type`, and `role` properties

For example:

``` js
{ type: 'relation',
  id: 2568782,
  version: 2,
  timestamp: 1363901133,
  changeset: 15448381,
  uid: 4499,
  user: 'Jochen Topf',
  members: 
   [ { id: 190304472, type: 'way', role: 'outer' },
     { id: 190304664, type: 'way', role: 'outer' } ],
  tags: 
   { name: 'Motutapu Island',
     type: 'multipolygon',
     place: 'island',
     'LINZ:layer': 'island_poly',
     source_ref: 'http://www.linz.govt.nz/topography/topo-maps/',
     attribution: 'http://wiki.osm.org/wiki/Attribution#LINZ',
     'LINZ:dataset': 'mainland',
     'LINZ:source_version': '2012-06-06' } }
```

# install

```
npm install o5m-decode
```

# license

BSD
