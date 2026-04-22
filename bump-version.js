#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read both package.json files
const rootPackagePath = path.join(__dirname, 'package.json');
const clientPackagePath = path.join(__dirname, 'client', 'package.json');

const rootPackageJson = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
const clientPackageJson = JSON.parse(fs.readFileSync(clientPackagePath, 'utf8'));

// Parse current version and increment patch
const [major, minor, patch] = clientPackageJson.version.split('.').map(Number);
const oldVersion = clientPackageJson.version;
const newVersion = `${major}.${minor}.${patch + 1}`;

// Update both package.json files
rootPackageJson.version = newVersion;
clientPackageJson.version = newVersion;

fs.writeFileSync(rootPackagePath, JSON.stringify(rootPackageJson, null, 2) + '\n');
fs.writeFileSync(clientPackagePath, JSON.stringify(clientPackageJson, null, 2) + '\n');

console.log(`🚀 Version bumped: ${oldVersion} → ${newVersion}`);
console.log(`📝 Updated both package.json files`);
console.log(`✅ Ready for deployment!`);