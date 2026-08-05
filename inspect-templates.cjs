// Quick inspector: prints page sizes, tries to find any text near
// the "date" area on page 1 of each template, so we can re-measure
// the (x, y) of the dd/mm/yyyy cells.
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');

const TEMPLATES = [
  'kiro_trial.pdf',
  'robotic_trial.pdf',
  'coding_trial.pdf',
  'art_trial.pdf',
];

const PUBLIC_DIR = path.join(__dirname, 'frontend', 'public', 'templates');

(async () => {
  for (const name of TEMPLATES) {
    const p = path.join(PUBLIC_DIR, name);
    if (!fs.existsSync(p)) {
      console.log(`SKIP: ${name} (missing)`);
      continue;
    }
    const bytes = fs.readFileSync(p);
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();
    console.log(`\n=== ${name} ===`);
    console.log(`pages: ${pages.length}`);
    pages.forEach((page, idx) => {
      const { width, height } = page.getSize();
      console.log(`  page ${idx + 1}: width=${width.toFixed(2)} height=${height.toFixed(2)}`);
    });
  }
})();
