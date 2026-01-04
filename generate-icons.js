// Script to generate X Article Helper icons
// Run with: node generate-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG
function makeCRCTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = makeCRCTable();

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// Check if point is inside the X logo shape
function isInsideXLogo(x, y, size) {
  const s = size;
  const margin = s * 0.15;
  const strokeWidth = s * 0.12;
  
  // Normalize coordinates
  const nx = x / s;
  const ny = y / s;
  
  // X logo consists of two diagonal strokes that cross
  // Stroke 1: top-left to bottom-right (with offset for the X shape)
  // Stroke 2: top-right to bottom-left (with offset for the X shape)
  
  const m = margin / s;
  const sw = strokeWidth / s;
  
  // Line 1: from (m, m) towards (1-m, 1-m) but with X shape bend
  // Line 2: from (1-m, m) towards (m, 1-m) but with X shape bend
  
  // Simplified X: two crossing lines
  // Distance from point to line
  
  // Line 1: y = x (diagonal from top-left to bottom-right)
  const dist1 = Math.abs(ny - nx) / Math.sqrt(2);
  
  // Line 2: y = 1 - x (diagonal from top-right to bottom-left)  
  const dist2 = Math.abs(ny - (1 - nx)) / Math.sqrt(2);
  
  // Check if within stroke width and within bounds
  const inBounds = nx > m && nx < (1 - m) && ny > m && ny < (1 - m);
  
  return inBounds && (dist1 < sw || dist2 < sw);
}

// Check if point is inside the page/document icon (bottom right corner)
function isInsidePage(x, y, size) {
  const pageSize = size * 0.35;
  const pageX = size - pageSize - size * 0.05;
  const pageY = size - pageSize - size * 0.05;
  const cornerFold = pageSize * 0.25;
  
  // Check if inside the page rectangle
  if (x >= pageX && x <= pageX + pageSize && y >= pageY && y <= pageY + pageSize) {
    // Check if in the corner fold area (top right of page)
    const relX = x - pageX;
    const relY = y - pageY;
    
    if (relX > pageSize - cornerFold && relY < cornerFold) {
      // In the fold triangle - check if below the fold line
      const foldProgress = (relX - (pageSize - cornerFold)) / cornerFold;
      if (relY < cornerFold * (1 - foldProgress)) {
        return false; // In the cut-off corner
      }
    }
    return true;
  }
  return false;
}

// Check if point is on page lines (for detail)
function isOnPageLines(x, y, size) {
  const pageSize = size * 0.35;
  const pageX = size - pageSize - size * 0.05;
  const pageY = size - pageSize - size * 0.05;
  const lineWidth = Math.max(1, size * 0.02);
  
  const relX = x - pageX;
  const relY = y - pageY;
  
  // Three horizontal lines on the page
  const lineSpacing = pageSize * 0.2;
  const lineStart = pageSize * 0.15;
  const lineEnd = pageSize * 0.7;
  
  for (let i = 1; i <= 3; i++) {
    const lineY = pageSize * 0.35 + i * lineSpacing * 0.5;
    if (relY >= lineY - lineWidth/2 && relY <= lineY + lineWidth/2 &&
        relX >= lineStart && relX <= lineEnd) {
      return true;
    }
  }
  return false;
}

// Create PNG with X logo and page icon
function createPNG(size) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(6, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  
  const ihdr = createChunk('IHDR', ihdrData);
  
  // Generate pixel data
  const rawData = [];
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 1;
  
  for (let y = 0; y < size; y++) {
    rawData.push(0);
    for (let x = 0; x < size; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check what element this pixel belongs to
      const inPage = isInsidePage(x, y, size);
      const onPageLines = isOnPageLines(x, y, size);
      const inXLogo = isInsideXLogo(x, y, size);
      
      if (distance <= radius) {
        if (inPage && !onPageLines) {
          // Page background - white
          rawData.push(255, 255, 255, 255);
        } else if (onPageLines) {
          // Page lines - gray
          rawData.push(100, 100, 100, 255);
        } else if (inXLogo && !inPage) {
          // X logo - white
          rawData.push(255, 255, 255, 255);
        } else {
          // Background - black
          rawData.push(0, 0, 0, 255);
        }
      } else {
        // Outside circle - transparent
        rawData.push(0, 0, 0, 0);
      }
    }
  }
  
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([pngSignature, ihdr, idat, iend]);
}

// Generate icons
const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

sizes.forEach(size => {
  const png = createPNG(size);
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created icon${size}.png`);
});

console.log('\nIcons generated! Reload the extension to see them.');
