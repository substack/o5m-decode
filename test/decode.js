var decode = require('../')
var concat = require('concat-stream')
var to = require('to2')
var path = require('path')
var fs = require('fs')
var test = require('tape')
var gunzip = require('zlib').createGunzip

test('decode', function (t) {
  t.plan(5)
  var d = decode()
  var pending = 2
  var actual = [], expected = []
  read('tile.o5m.gz').pipe(d).pipe(to.obj(write, end))
  read('tile.json.gz').pipe(concat(function (body) {
    expected = JSON.parse(body)
    if (--pending === 0) compare()
  }))
  function write (row, enc, next) {
    actual.push(row)
    next()
  }
  function end () {
    if (--pending === 0) compare()
  }
  function compare() {
    var enodes = expected.filter(type('node'))
    var anodes = actual.filter(type('node'))
    t.deepEqual(anodes, enodes, 'nodes')

    var eways = expected.filter(type('way'))
    var aways = actual.filter(type('way'))
    t.deepEqual(aways, eways, 'ways')
  
    var erels = expected.filter(type('relation'))
    var arels = actual.filter(type('relation'))
    t.deepEqual(arels, erels, 'rels')

    var stamps = actual.filter(type('timestamp'))
    var time = new Date(stamps[0].time*1000).toISOString()
    t.equal(time, '2015-10-31T00:28:02.000Z')

    var abox = actual.filter(type('bbox'))
    var ebox = expected.filter(type('bbox'))
    t.deepEqual(abox, ebox, 'bboxes')
  }
  function type (name) {
    return function (row) { return row.type === name }
  }
})

function read (name) {
  var r = fs.createReadStream(path.join(__dirname, 'files', name))
  return r.pipe(gunzip())
}
