import { readFile } from 'node:fs/promises';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
for (const f of ['art_trial.pdf', 'coding_trial.pdf', 'kiro_trial.pdf']) {
  console.log('===', f, '===');
  const data = new Uint8Array(await readFile('public/templates/' + f));
  const doc = await pdfjs.getDocument({ data }).promise;
  const p1 = await doc.getPage(1);
  const txt = await p1.getTextContent();
  const items = txt.items.filter(i => i.transform[5] > 600 && i.transform[5] < 640);
  items.sort((a, b) => a.transform[4] - b.transform[4]).forEach(i =>
    process.stdout.write(`${i.str}(${i.transform[4].toFixed(1)}) `)
  );
  console.log();
}
