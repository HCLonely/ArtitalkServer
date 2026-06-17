const fs = require('node:fs');
const path = require('node:path');

function parseLeanCloudJsonl(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line));
}

function readLeanCloudExport(filePath) {
  return parseLeanCloudJsonl(fs.readFileSync(filePath, 'utf8'));
}

function classNameFromFile(filePath) {
  return path.basename(filePath).replace(/\.\d+\.jsonl$/, '');
}

module.exports = {
  parseLeanCloudJsonl,
  readLeanCloudExport,
  classNameFromFile
};
