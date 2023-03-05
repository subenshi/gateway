// Read package.json
const fs = require('fs');
const path = require('path');

let name;
let version;

if (!name) {
  // Check if package.json file exists
  const packagePath = path.join(__dirname, '..', '..', 'package.json');
  if (!fs.existsSync(packagePath)) {
    throw new Error('package.json file not found');
  }
  
  // Read package.json file
  const contents = require(packagePath);
  name = contents.name;
  version = contents.version;
}

// Get version
module.exports.name = name;
module.exports.version = version;