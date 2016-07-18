var through = require('through2')
var sprintf = require('sprintf')
var xtend = require('xtend')

var BEGIN = 1, TYPE = 2, LEN = 3, DATA = 4, END = 5
var SIGNED = 10

var types = {}
types[0x10] = 'node'
types[0x11] = 'way'
types[0x12] = 'relation'
types[0xdb] = 'bbox'
types[0xdc] = 'timestamp'
types[0xe0] = 'header'
types[0xee] = 'sync'
types[0xef] = 'jump'
types[0xff] = 'reset'

module.exports = function () {
  var state = BEGIN
  var fstate = null
  var len = 0
  var npow = 1
  var chunks = []
  var size = 0
  var data = null
  var prev = null
  var strings = []
  var strpair = []
  return through.obj(write)

  function write (buf, enc, next) {
    for (var i = 0; i < buf.length; i++) {
      var b = buf[i]
      if (state === BEGIN && b !== 0xff) {
        next(new Error('first byte in frame, expected: 0xff, got ' + show(b)))
      } else if (state === BEGIN) {
        state = TYPE
      } else if (state === TYPE && b === 0xff) { // reset
        state = TYPE
        prev = null
      } else if (state === TYPE) {
        state = LEN
        data = { type: types[b] || b }
      } else if (state === LEN) {
        len += (b & 0x7f) * npow
        npow *= 128
        if (b < 0x80) {
          npow = 1
          state = DATA
        }
      } else if (state === DATA) {
        var j = Math.min(buf.length, i + len - size)
        chunks.push(buf.slice(i,j))
        size += j-i
        if (size === len) {
          var buffer = Buffer.concat(chunks)
          chunks = []
          flush(this, buffer, data)
          state = TYPE
          len = 0
          size = 0
        }
        i = j - 1
      } else if (state === END && b !== 0xfe) {
        next(new Error('last byte in frame, expected: 0xfe, got ' + show(b)))
      } else if (state === END) {
        //...
      }
    }
    next()
  }
  function show (n) { return sprintf('0x%02x', n) }
  function flush (stream, buf, data) {
    var field = 0, value = 0, npow = 1, strpos = 0
    if (data.type === 'timestamp') {
      for (var i = 0; i < buf.length; i++) {
        var b = buf[i]
        if (field === 0) signed('time')
      }
    } else if (data.type === 'node') {
      for (var i = 0; i < buf.length; i++) {
        var b = buf[i]
        if (field === 0) signedDelta('id')
        else if (field === 1 && b === 0x00) {
          field = 5
        } else if (field === 1) {
          unsigned('version')
        } else if (field === 2) {
          signedDelta('timestamp')
        } else if (field === 3 && data.timestamp === 0) {
          field = 5
          i--
        } else if (field === 3) {
          signedDelta('changeset')
        } else if (field === 4) {
          stringPair('uid','user')
        } else if (field === 5) {
          signedDelta('longitude')
        } else if (field === 6) {
          signedDelta('latitude')
        } else if (field > 6) {
          stringPair('_kv','tags')
        }
      }
    }
    prev = data
    if (data.type === 'node') {
      stream.push(xtend(data, {
        latitude: data.latitude * 1e-7 - 90,
        longitude: data.longitude * 1e-7 - 180
      }))
    } else stream.push(data)

    function signedDelta (name) {
      value += (b & (npow === 1 ? 0x7e : 0x7f)) * npow
      if (npow === 1 && (b & 0x1 === 1)) value *= -1
      npow *= 128
      if (b < 0x80) {
        if (prev && prev[name] !== undefined) value += prev[name]
        npow = 1
        data[name] = value
        value = 0
        field++
      }
    }
    function signed (name) {
      value += (b & (npow === 1 ? 0x7e : 0x7f)) * npow
      npow *= 128
      if (b < 0x80) {
        data[name] = value
        npow = 1
        value = 0
        field++
      }
    }
    function unsigned (name) {
      value += (b & 0x7f) * npow
      npow *= 128
      if (b < 0x80) {
        npow = 1
        data[name] = value
        value = 0
        field++
      }
    }
    function stringPair (name0, name1) {
      if (strpos === 0 && b === 0x00) {
        strpos++
      } else if (strpos === 0) {
        value += (b & 0x7f) * npow
        npow *= 128
        if (b < 0x80) {
          strpair[0] = strings[value-1][0]
          strpair[1] = strings[value-1][1]
          finish()
        }
      } else if (strpos === 1) {
        if (name0 === 'uid') {
          value = 0
          npow = 1
          for (var j = i+1; j < buf.length; j++) {
            if (buf[j] === 0x00) break
            value += buf[j] * npow
            npow *= 256
          }
          strpair[0] = value
          value = 0
          npow = 1
        } else {
          for (var j = i+1; j < buf.length; j++) {
            if (buf[j] === 0x00) break
          }
          strpair[0] = buf.slice(i, j).toString('utf8')
        }
        i = j
        strpos++
      } else if (strpos === 2) {
        for (var j = i+1; j < buf.length; j++) {
          if (buf[j] === 0x00) break
        }
        strpair[1] = buf.slice(i, j).toString('utf8')
        strings.unshift([strpair[0],strpair[1]])
        i = j
        finish()
      }

      function finish () {
        if (name0 === '_kv') {
          if (!data[name1]) data[name1] = {}
          data[name1][strpair[0]] = strpair[1]
        } else {
          data[name0] = strpair[0]
          data[name1] = strpair[1]
        }
        value = 0
        npow = 1
        strpos = 0
        field++
      }
    }
  }
}
