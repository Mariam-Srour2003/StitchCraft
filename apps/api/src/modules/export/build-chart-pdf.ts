import { contrastTextColor } from '@stitchcraft/color';
import { decodeGrid, isDmcColor, Pattern } from '@stitchcraft/types';
import PDFDocument from 'pdfkit';
import { countPaletteUsage } from './count-palette-usage';

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 36;
const RULER_SIZE = 18;
const TITLE_HEIGHT = 24;
const CELL_PT = 14;
const CELLS_PER_TILE_X = Math.floor((PAGE_WIDTH - 2 * PAGE_MARGIN - RULER_SIZE) / CELL_PT);
const CELLS_PER_TILE_Y = Math.floor((PAGE_HEIGHT - 2 * PAGE_MARGIN - RULER_SIZE - TITLE_HEIGHT) / CELL_PT);

/**
 * Tiled, printable PDF chart: one page per tile (grid + row/col rulers,
 * bold every 10 like the editor), then a legend/materials page. Cells show
 * the 1-based palette number rather than the palette's Unicode symbol glyph
 * - pdfkit's bundled standard fonts don't reliably cover the shape glyphs
 * in `assignSymbols`' extended alphabet once a palette exceeds ~27 colors,
 * and numbers stay unambiguous at the small print size a tiled chart needs
 * anyway. The legend page spells out the full symbol/DMC code/name per row.
 *
 * Not optimized for very large patterns: each cell is its own vector+text
 * object (no run-length merging of same-color neighbors), so a 200x200
 * pattern produces a large multi-page file. Fine for typical/demo sizes;
 * worth revisiting if large patterns turn out to be common.
 */
export async function buildChartPdf(pattern: Pattern): Promise<Buffer> {
  const decoded = decodeGrid(pattern.grid, pattern.width);
  const counts = countPaletteUsage(pattern);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const tilesX = Math.max(1, Math.ceil(pattern.width / CELLS_PER_TILE_X));
    const tilesY = Math.max(1, Math.ceil(pattern.height / CELLS_PER_TILE_Y));
    const totalTiles = tilesX * tilesY;

    let pageIndex = 0;
    for (let tileY = 0; tileY < tilesY; tileY++) {
      for (let tileX = 0; tileX < tilesX; tileX++) {
        if (pageIndex > 0) doc.addPage({ size: 'LETTER', margin: PAGE_MARGIN });
        pageIndex++;
        drawTilePage(doc, pattern, decoded, {
          startX: tileX * CELLS_PER_TILE_X,
          startY: tileY * CELLS_PER_TILE_Y,
          endX: Math.min(pattern.width, (tileX + 1) * CELLS_PER_TILE_X),
          endY: Math.min(pattern.height, (tileY + 1) * CELLS_PER_TILE_Y),
          pageLabel: `page ${pageIndex} of ${totalTiles}`,
        });
      }
    }

    doc.addPage({ size: 'LETTER', margin: PAGE_MARGIN });
    drawLegendPage(doc, pattern, counts);

    doc.end();
  });
}

interface Tile {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  pageLabel: string;
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function drawTilePage(doc: PdfDoc, pattern: Pattern, decoded: Int16Array[], tile: Tile): void {
  const { startX, startY, endX, endY, pageLabel } = tile;
  const originX = PAGE_MARGIN + RULER_SIZE;
  const originY = PAGE_MARGIN + TITLE_HEIGHT;

  doc
    .fontSize(10)
    .fillColor('#000000')
    .text(`${pattern.name} — ${pageLabel} (columns ${startX + 1}-${endX}, rows ${startY + 1}-${endY})`, PAGE_MARGIN, PAGE_MARGIN, {
      width: PAGE_WIDTH - 2 * PAGE_MARGIN,
    });

  doc.fontSize(6).fillColor('#666666');
  for (let x = startX; x < endX; x++) {
    if ((x + 1) % 10 !== 0 && x !== startX) continue;
    const px = originX + (x - startX) * CELL_PT;
    doc.text(String(x + 1), px, originY - 9, { width: CELL_PT, align: 'center' });
  }
  for (let y = startY; y < endY; y++) {
    if ((y + 1) % 10 !== 0 && y !== startY) continue;
    const py = originY + (y - startY) * CELL_PT;
    doc.text(String(y + 1), PAGE_MARGIN, py + 3, { width: RULER_SIZE - 3, align: 'right' });
  }

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const paletteIndex = decoded[y][x];
      const entry = pattern.palette[paletteIndex];
      if (paletteIndex < 0 || !entry) continue;

      const px = originX + (x - startX) * CELL_PT;
      const py = originY + (y - startY) * CELL_PT;
      doc.rect(px, py, CELL_PT, CELL_PT).fill(entry.color.hex);
      doc
        .fontSize(7)
        .fillColor(contrastTextColor(entry.color.rgb))
        .text(String(paletteIndex + 1), px, py + 3, { width: CELL_PT, align: 'center' });
    }
  }

  const tileWidthPt = (endX - startX) * CELL_PT;
  const tileHeightPt = (endY - startY) * CELL_PT;
  for (let x = startX; x <= endX; x++) {
    const bold = x % 10 === 0;
    const px = originX + (x - startX) * CELL_PT;
    doc
      .lineWidth(bold ? 0.75 : 0.25)
      .strokeColor(bold ? '#999999' : '#cccccc')
      .moveTo(px, originY)
      .lineTo(px, originY + tileHeightPt)
      .stroke();
  }
  for (let y = startY; y <= endY; y++) {
    const bold = y % 10 === 0;
    const py = originY + (y - startY) * CELL_PT;
    doc
      .lineWidth(bold ? 0.75 : 0.25)
      .strokeColor(bold ? '#999999' : '#cccccc')
      .moveTo(originX, py)
      .lineTo(originX + tileWidthPt, py)
      .stroke();
  }
}

function drawLegendPage(doc: PdfDoc, pattern: Pattern, counts: number[]): void {
  doc.fontSize(14).fillColor('#000000').text('Legend & materials list', PAGE_MARGIN, PAGE_MARGIN);

  let cursorY = PAGE_MARGIN + 30;
  doc.fontSize(9);
  pattern.palette.forEach((entry, index) => {
    if (cursorY > PAGE_HEIGHT - PAGE_MARGIN - 16) {
      doc.addPage({ size: 'LETTER', margin: PAGE_MARGIN });
      cursorY = PAGE_MARGIN;
    }

    doc.rect(PAGE_MARGIN, cursorY, 14, 14).fill(entry.color.hex);
    const { color } = entry;
    const label = isDmcColor(color) ? `DMC ${color.code} — ${color.name}` : (color.label ?? color.hex);
    doc
      .fillColor('#000000')
      .text(`#${index + 1}  (symbol "${entry.symbol}")  ${label}  —  ${counts[index]}`, PAGE_MARGIN + 20, cursorY + 2);
    cursorY += 18;
  });
}
