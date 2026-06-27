const fs = require('fs');
const files = [
  'src/app/initiation/page.tsx',
  'src/app/tender/page.tsx',
  'src/app/tender-execution/page.tsx',
  'src/app/psd-execution/page.tsx',
  'src/app/progress/page.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/activeUnitId \: ''/g, "activeUnitId || '' : ''");
  fs.writeFileSync(f, content);
});
console.log('Done!');
