var to = require('to2')
var decode = require('../')()
process.stdin.pipe(decode).pipe(to.obj(write))

function write (row, enc, next) {
  console.log(row)
  next()
}
