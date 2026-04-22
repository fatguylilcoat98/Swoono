#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read package.json
const packagePath = path.join(__dirname, 'client', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Parse current version and increment patch
const [major, minor, patch] = packageJson.version.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version bumped: ${packageJson.version} → ${newVersion}`);