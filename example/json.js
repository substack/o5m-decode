var through = require('through2')
var decode = require('../')()
process.stdin.pipe(decode).pipe(json()).pipe(process.stdout)

function json () {
  var i = 0
  return through.obj(write, end)
  function write (row, enc, next) {
    next(null, (i++ === 0 ? '[' : ',') + JSON.stringify(row))
  }
  function end (next) {
    this.push(']')
    next()
  }
}
