const sharp = require('sharp')

console.log('Generating PWA icons from SVG...')

// Generate 192x192 icon
sharp('public/icon.svg')
  .resize(192, 192)
  .png()
  .toFile('public/icon-192.png')
  .then(() => console.log('✅ Generated icon-192.png'))
  .catch(err => console.error('❌ Error generating 192px icon:', err))

// Generate 512x512 icon
sharp('public/icon.svg')
  .resize(512, 512)
  .png()
  .toFile('public/icon-512.png')
  .then(() => console.log('✅ Generated icon-512.png'))
  .catch(err => console.error('❌ Error generating 512px icon:', err))

console.log('Icon generation complete!')