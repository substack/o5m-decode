var through = require('through2')
var sprintf = require('sprintf')

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
  return through.obj(write)

  function write (buf, enc, next) {
    for (var i = 0; i < buf.length; i++) {
      var b = buf[i]
      if (state === BEGIN && b !== 0xff) {
        next(new Error('first byte in frame, expected: 0xff, got ' + show(b)))
      } else if (state === BEGIN) {
        state = TYPE
      } else if (state === TYPE && b === 0xff) {
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
    if (data.type === 'node') {
      var field = 0
      var value = 0, npow = 1
      for (var i = 0; i < buf.length; i++) {
        var b = buf[i]
        if (field === 0) { // id
          value += (b & (npow === 1 ? 0x7e : 0x7f)) * npow
          if (npow === 1 && (b & 0x1 === 1)) value *= -1
          npow *= 128
          if (b < 0x80) {
            if (prev) value += prev.id
            npow = 1
            data.id = value
            field++
          }
        }
      }
      prev = data
    }
    console.log(buf)
    stream.push(data)
  }
}
