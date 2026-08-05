const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');
(async () => {
  const data = new Uint8Array(fs.readFileSync('public/templates/robotic_trial.pdf'));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  console.log('Page w x h:', vp.width, vp.height);
  const txt = await page.getTextContent();
  const items = txt.items.map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], h: i.height, w: i.width }));
  const near = items.filter(i => Math.abs(i.y - 219.4) < 12 || Math.abs(i.y - 209) < 12);
  near.sort((a, b) => a.y - b.y || a.x - b.x).forEach(i => console.log(JSON.stringify(i)));
})();