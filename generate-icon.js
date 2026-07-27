// Generate a 256x256 ICO file with a game controller design
// ICO format: header + directory entry + BMP data

function createIcon() {
    const size = 256;
    const pixels = [];

    // Create RGBA pixel data (256x256)
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const cx = x - size / 2;
            const cy = y - size / 2;
            const dist = Math.sqrt(cx * cx + cy * cy);

            let r = 15, g = 15, b = 35, a = 255;

            // Background circle gradient
            if (dist < 120) {
                const t = dist / 120;
                r = Math.floor(20 + t * 10);
                g = Math.floor(20 + t * 10);
                b = Math.floor(50 + t * 20);
                a = 255;

                // Red quadrant (top-left)
                if (cx < 0 && cy < 0 && dist < 100) {
                    r = Math.floor(231 * (1 - dist / 140));
                    g = Math.floor(76 * (1 - dist / 140));
                    b = Math.floor(60 * (1 - dist / 140));
                }
                // Blue quadrant (top-right)
                if (cx >= 0 && cy < 0 && dist < 100) {
                    r = Math.floor(52 * (1 - dist / 140));
                    g = Math.floor(152 * (1 - dist / 140));
                    b = Math.floor(219 * (1 - dist / 140));
                }
                // Green quadrant (bottom-left)
                if (cx < 0 && cy >= 0 && dist < 100) {
                    r = Math.floor(46 * (1 - dist / 140));
                    g = Math.floor(204 * (1 - dist / 140));
                    b = Math.floor(113 * (1 - dist / 140));
                }
                // Yellow quadrant (bottom-right)
                if (cx >= 0 && cy >= 0 && dist < 100) {
                    r = Math.floor(241 * (1 - dist / 140));
                    g = Math.floor(196 * (1 - dist / 140));
                    b = Math.floor(15 * (1 - dist / 140));
                }
            }

            // Center circle (dark)
            if (dist < 40) {
                r = 20;
                g = 20;
                b = 40;
            }

            // "G" letter in center
            if (dist >= 10 && dist < 35) {
                const angle = Math.atan2(cy, cx);
                // G shape: arc with opening on right + horizontal bar
                if ((angle > 0.3 || angle < -0.3) && !(angle > -0.3 && angle < 0.3 && cy < 0)) {
                    if (dist > 20 && dist < 32) {
                        r = 255; g = 255; b = 255;
                    }
                }
                // Horizontal bar of G
                if (cx >= 0 && cx < 18 && cy >= -3 && cy <= 3 && dist > 10) {
                    r = 255; g = 255; b = 255;
                }
            }

            // Outer ring
            if (dist >= 115 && dist < 122) {
                const angle = Math.atan2(cy, cx);
                const segment = ((angle + Math.PI) / (Math.PI * 2)) * 4;
                if (segment < 1) { r = 231; g = 76; b = 60; }
                else if (segment < 2) { r = 52; g = 152; b = 219; }
                else if (segment < 3) { r = 46; g = 204; b = 113; }
                else { r = 241; g = 196; b = 15; }
            }

            // Outside circle = transparent
            if (dist >= 122) {
                r = 0; g = 0; b = 0; a = 0;
            }

            pixels.push(b, g, r, a); // BGRA for BMP/ICO
        }
    }

    // Build ICO file
    const pixelData = Buffer.from(pixels);
    const imageSize = size * size * 4;

    // PNG approach is easier for 256x256 ICO
    // Let's use raw BMP in ICO format
    const bmpHeaderSize = 40;
    const dataSize = bmpHeaderSize + imageSize;

    // ICO Header (6 bytes)
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);  // reserved
    header.writeUInt16LE(1, 2);  // type: 1 = ICO
    header.writeUInt16LE(1, 4);  // number of images

    // ICO Directory Entry (16 bytes)
    const dirEntry = Buffer.alloc(16);
    dirEntry.writeUInt8(0, 0);    // width (0 = 256)
    dirEntry.writeUInt8(0, 1);    // height (0 = 256)
    dirEntry.writeUInt8(0, 2);    // color palette
    dirEntry.writeUInt8(0, 3);    // reserved
    dirEntry.writeUInt16LE(1, 4); // color planes
    dirEntry.writeUInt16LE(32, 6);// bits per pixel
    dirEntry.writeUInt32LE(dataSize, 8);  // image data size
    dirEntry.writeUInt32LE(22, 12);       // offset to image data

    // BMP Info Header (40 bytes)
    const bmpHeader = Buffer.alloc(40);
    bmpHeader.writeUInt32LE(40, 0);       // header size
    bmpHeader.writeInt32LE(size, 4);      // width
    bmpHeader.writeInt32LE(size * 2, 8);  // height (doubled for ICO)
    bmpHeader.writeUInt16LE(1, 12);       // planes
    bmpHeader.writeUInt16LE(32, 14);      // bits per pixel
    bmpHeader.writeUInt32LE(0, 16);       // compression
    bmpHeader.writeUInt32LE(imageSize, 20); // image size
    bmpHeader.writeInt32LE(0, 24);        // x pixels per meter
    bmpHeader.writeInt32LE(0, 28);        // y pixels per meter
    bmpHeader.writeUInt32LE(0, 32);       // colors used
    bmpHeader.writeUInt32LE(0, 36);       // important colors

    // BMP pixels are stored bottom-up, so flip
    const flippedPixels = Buffer.alloc(imageSize);
    for (let y = 0; y < size; y++) {
        const srcOffset = y * size * 4;
        const dstOffset = (size - 1 - y) * size * 4;
        pixelData.copy(flippedPixels, dstOffset, srcOffset, srcOffset + size * 4);
    }

    const ico = Buffer.concat([header, dirEntry, bmpHeader, flippedPixels]);
    require('fs').writeFileSync(require('path').join(__dirname, 'icon.ico'), ico);
    console.log('Icon created: icon.ico');
}

createIcon();
