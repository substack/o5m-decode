var through = require('through2')
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
  function show (n) {
    return '0x' + (n<16?'0':'')+n.toString(16)
  }
  function flush (stream, buf, data) {
    var field = 0, value = 0, sign = 1, npow = 1, strpos = 0
    var ix0 = 0, ix1 = 0
    if (data.type === 'timestamp') {
      for (var i = 0; i < buf.length; i++) {
        var b = buf[i]
        if (field === 0) signed('time')
      }
    } else if (data.type === 'node') {
      for (var i = 0; i < buf.length; i++) {
        var b = buf[i]
        if (docFields()) {
        } else if (field === 5) {
          signedDelta('longitude')
        } else if (field === 6) {
          signedDelta('latitude')
        } else if (field > 6) {
          stringPair('_kv','tags')
        }
      }
    } else if (data.type === 'way') {
      data.refs = []
      var refsize = 0
      for (var i = 0; i < buf.length; i++) {
        var b = buf[i]
        if (docFields()) {
        } else if (field === 5) {
          unsigned('reflen')
        } else if (refsize < data.reflen) {
          signedDelta('refs')
          refsize++
        } else if (refsize === data.reflen) {
          stringPair('_kv','tags')
        }
      }
    }
    prev = data
    if (data.type === 'node') {
      stream.push(xtend(data, {
        latitude: data.latitude * 1e-7,
        longitude: data.longitude * 1e-7
      }))
    } else if (data.type === 'way') {
      delete data.reflen
      stream.push(data)
    } else stream.push(data)

    function docFields () {
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
      } else return false
      return true
    }

    function signedDelta (name) {
      value += (b & (npow === 1 ? 0x7e : 0x7f)) * npow
      if (npow === 1 && (b & 0x1 === 1)) sign = -1
      npow *= 128
      if (b < 0x80) {
        value = value * sign / 2
        if (Array.isArray(data[name])) {
          if (data[name].length > 0) {
            value += data[name][data[name].length-1]
          } else if (prev && Array.isArray(prev[name])
          && prev[name].length > 0) {
            value += prev[name][prev[name].length-1]
          }
          data[name].push(value)
        } else {
          if (prev && prev[name] !== undefined) {
            value += prev[name]
          }
          data[name] = value
        }
        npow = 1
        value = 0
        sign = 1
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
        data[name] = value
        npow = 1
        value = 0
        field++
      }
    }
    function stringPair (name0, name1) {
      if (strpos === 0 && b === 0x00) {
        ix0 = i+1
        strpair[0] = name0 === 'uid' ? 0 : ''
        strpair[1] = ''
        strpos++
      } else if (strpos === 0) {
        value += (b & 0x7f) * npow
        npow *= 128
        if (b < 0x80) {
          strpair[0] = strings[value-1][0]
          strpair[1] = strings[value-1][1]
          finish()
        }
      } else if (strpos === 1 && b === 0x00) {
        if (name0 !== 'uid') {
          strpair[0] = buf.slice(ix0, i).toString('utf8')
        }
        strpos++
        ix1 = i+1
      } else if (strpos === 1) {
        if (name0 === 'uid') {
          strpair[0] += (b & 0x7f) * npow
          npow *= 128
        }
      } else if (strpos === 2 && b === 0x00) {
        strpair[1] = buf.slice(ix1, i).toString('utf8')
        strings.unshift([strpair[0],strpair[1]])
        strpos++
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
        ix0 = 0
        ix1 = 0
        field++
      }
    }
  }
}
