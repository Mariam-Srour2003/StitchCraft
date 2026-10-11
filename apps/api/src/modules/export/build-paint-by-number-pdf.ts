import PDFDocument from 'pdfkit';

import type { Pattern, RegionMap } from '@stitchcraft/types';
import { computeRegions, decodeGrid, isDmcColor } from '@stitchcraft/types';

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const TITLE_HEIGHT = 28;
const AREA_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const AREA_HEIGHT = PAGE_HEIGHT - 2 * MARGIN - TITLE_HEIGHT;
/**
 * Below this cell size (about 2.5 mm) small areas get too fiddly to read and
 * paint, so the canvas is split over several sheets instead of shrunk onto
 * one. Up to 77 x 98 cells fit on a single sheet.
 */
const MIN_CANVAS_CELL = 7;
const MAX_CANVAS_CELL = 24;
const LINE_COLOR = '#4a4a4a';
const NUMBER_COLOR = '#3a3a3a';

type PdfDoc = InstanceType<typeof PDFDocument>;

interface Sheet {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * A printable paint-by-number kit: a reference page (the finished picture in
 * colour and the numbered colour key), then the canvas - every area outlined
 * and numbered once, at its deepest cell, with the number sized to fit the
 * area. Big patterns are split over several sheets so numbers stay legible.
 */
export async function buildPaintByNumberPdf(pattern: Pattern): Promise<Buffer> {
  const rows = decodeGrid(pattern.grid, pattern.width);
  const map = computeRegions(rows, pattern.width, pattern.height);

  const fitCell = Math.min(AREA_WIDTH / pattern.width, AREA_HEIGHT / pattern.height);
  const cell = Math.min(MAX_CANVAS_CELL, Math.max(MIN_CANVAS_CELL, fitCell));
  const sheets = splitIntoSheets(pattern.width, pattern.height, cell);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawReferencePage(doc, pattern, rows, map, sheets.length);
    sheets.forEach((sheet, index) => {
      doc.addPage({ size: 'LETTER', margin: MARGIN });
      const label =
        sheets.length === 1
          ? 'canvas'
          : `canvas, sheet ${index + 1} of ${sheets.length} (columns ${sheet.startX + 1}-${sheet.endX}, rows ${sheet.startY + 1}-${sheet.endY})`;
      doc.fontSize(10).fillColor('#000000').text(`${pattern.name} - ${label}`, MARGIN, MARGIN, {
        width: AREA_WIDTH,
      });
      drawCanvas(doc, pattern, map, sheet, cell, MARGIN, MARGIN + TITLE_HEIGHT);
    });

    doc.end();
  });
}

/**
 * Splits the canvas into as few sheets as fit at this cell size, sharing the
 * cells out evenly (70 columns -> 35 + 35, not 60 + a 10-column sliver).
 */
export function splitIntoSheets(width: number, height: number, cell: number): Sheet[] {
  const maxPerSheetX = Math.max(1, Math.floor(AREA_WIDTH / cell));
  const maxPerSheetY = Math.max(1, Math.floor(AREA_HEIGHT / cell));
  const perSheetX = Math.ceil(width / Math.ceil(width / maxPerSheetX));
  const perSheetY = Math.ceil(height / Math.ceil(height / maxPerSheetY));
  const sheets: Sheet[] = [];
  for (let startY = 0; startY < height; startY += perSheetY) {
    for (let startX = 0; startX < width; startX += perSheetX) {
      sheets.push({
        startX,
        startY,
        endX: Math.min(width, startX + perSheetX),
        endY: Math.min(height, startY + perSheetY),
      });
    }
  }
  return sheets;
}

function drawReferencePage(
  doc: PdfDoc,
  pattern: Pattern,
  rows: Int16Array[],
  map: RegionMap,
  sheetCount: number,
): void {
  doc.fontSize(16).fillColor('#000000').text(pattern.name, MARGIN, MARGIN);
  doc
    .fontSize(9)
    .fillColor('#555555')
    .text(
      `Paint by number - ${pattern.width} x ${pattern.height}, ${map.regions.length} areas, ` +
        `${sheetCount} canvas ${sheetCount === 1 ? 'sheet' : 'sheets'}. Paint each area the colour of its number.`,
      MARGIN,
      MARGIN + 22,
      { width: AREA_WIDTH },
    );

  // The finished picture, filled in - one rectangle per run of a colour.
  const top = MARGIN + 48;
  const maxHeight = 330;
  const cell = Math.min(AREA_WIDTH / pattern.width, maxHeight / pattern.height);
  const left = MARGIN + (AREA_WIDTH - cell * pattern.width) / 2;
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const index = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === index) end++;
      const entry = pattern.palette[index];
      if (entry) {
        // Slight overlap hides hairline gaps between rectangles in PDF viewers.
        doc
          .rect(left + x * cell, top + y * cell, (end - x) * cell + 0.3, cell + 0.3)
          .fill(entry.color.hex);
      }
      x = end;
    }
  });
  doc
    .lineWidth(0.5)
    .strokeColor('#999999')
    .rect(left, top, cell * pattern.width, cell * pattern.height)
    .stroke();

  // Colour key, in two columns.
  const areas = new Array<number>(pattern.palette.length).fill(0);
  for (const region of map.regions) areas[region.paletteIndex]++;
  const used = pattern.palette.filter((_, index) => areas[index] > 0);

  let cursorY = top + cell * pattern.height + 24;
  doc.fontSize(12).fillColor('#000000').text('Colour key', MARGIN, cursorY);
  cursorY += 20;
  const columnWidth = AREA_WIDTH / 2;
  const rowHeight = 20;
  used.forEach((entry, i) => {
    const column = i % 2;
    if (column === 0 && i > 0) cursorY += rowHeight;
    if (cursorY > PAGE_HEIGHT - MARGIN - rowHeight) {
      doc.addPage({ size: 'LETTER', margin: MARGIN });
      cursorY = MARGIN;
    }
    const x = MARGIN + column * columnWidth;
    doc.rect(x, cursorY, 16, 16).fill(entry.color.hex);
    doc.lineWidth(0.5).strokeColor('#999999').rect(x, cursorY, 16, 16).stroke();
    const { color } = entry;
    const name = isDmcColor(color) ? `DMC ${color.code} ${color.name}` : (color.label ?? color.hex);
    const count = areas[entry.index];
    doc
      .fontSize(10)
      .fillColor('#000000')
      .text(String(entry.index + 1), x + 22, cursorY + 3, { width: 22, continued: false });
    doc
      .fontSize(9)
      .fillColor('#333333')
      .text(`${name} - ${count} ${count === 1 ? 'area' : 'areas'}`, x + 46, cursorY + 4, {
        width: columnWidth - 52,
        lineBreak: false,
        ellipsis: true,
      });
  });
}

/** Region outlines (merged into long straight segments) and one number per region. */
function drawCanvas(
  doc: PdfDoc,
  pattern: Pattern,
  map: RegionMap,
  sheet: Sheet,
  cell: number,
  originX: number,
  originY: number,
): void {
  const { width, ids } = map;
  const idAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= map.width || y >= map.height ? -1 : ids[y * width + x];
  const px = (x: number) => originX + (x - sheet.startX) * cell;
  const py = (y: number) => originY + (y - sheet.startY) * cell;

  doc.lineWidth(0.7).strokeColor(LINE_COLOR).lineCap('square');

  // Horizontal edges: between row y-1 and row y.
  for (let y = sheet.startY; y <= sheet.endY; y++) {
    let runStart = -1;
    for (let x = sheet.startX; x <= sheet.endX; x++) {
      const edge = x < sheet.endX && idAt(x, y - 1) !== idAt(x, y);
      if (edge && runStart < 0) runStart = x;
      if (!edge && runStart >= 0) {
        doc.moveTo(px(runStart), py(y)).lineTo(px(x), py(y));
        runStart = -1;
      }
    }
  }
  // Vertical edges: between column x-1 and column x.
  for (let x = sheet.startX; x <= sheet.endX; x++) {
    let runStart = -1;
    for (let y = sheet.startY; y <= sheet.endY; y++) {
      const edge = y < sheet.endY && idAt(x - 1, y) !== idAt(x, y);
      if (edge && runStart < 0) runStart = y;
      if (!edge && runStart >= 0) {
        doc.moveTo(px(x), py(runStart)).lineTo(px(x), py(y));
        runStart = -1;
      }
    }
  }
  doc.stroke();

  // A sheet edge that cuts through an area: dashed, so it isn't mistaken for an outline.
  doc
    .lineWidth(0.5)
    .strokeColor('#aaaaaa')
    .dash(3, { space: 3 })
    .rect(
      px(sheet.startX),
      py(sheet.startY),
      (sheet.endX - sheet.startX) * cell,
      (sheet.endY - sheet.startY) * cell,
    )
    .stroke()
    .undash();

  doc.fillColor(NUMBER_COLOR);
  for (const region of map.regions) {
    const { labelX, labelY } = region;
    if (
      labelX < sheet.startX ||
      labelX >= sheet.endX ||
      labelY < sheet.startY ||
      labelY >= sheet.endY
    ) {
      continue;
    }
    const room = (2 * region.labelDepth + 1) * cell;
    const size = Math.max(5, Math.min(14, room * 0.5, cell * 0.8 + region.labelDepth * cell * 0.5));
    const label = String(region.paletteIndex + 1);
    doc.fontSize(size);
    const textWidth = doc.widthOfString(label);
    doc.text(label, px(labelX) + (cell - textWidth) / 2, py(labelY) + (cell - size * 0.75) / 2, {
      lineBreak: false,
    });
  }
}
