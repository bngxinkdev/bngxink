const fs = require("fs");

function read(file) {
  return JSON.parse(fs.readFileSync(`src/${file}`));
}

function write(file, data) {
  fs.writeFileSync(`src/${file}`, JSON.stringify(data, null, 2));
}

module.exports = { read, write };