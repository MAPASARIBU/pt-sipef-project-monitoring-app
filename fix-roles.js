const fs = require('fs');
const files = [
  'src/app/initiation/page.tsx',
  'src/app/tender/page.tsx',
  'src/app/tender-execution/page.tsx',
  'src/app/psd-execution/page.tsx',
  'src/app/progress/page.tsx',
  'src/app/contract/page.tsx'
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/const hasRegionalView = roleName\.includes\('regional director'\);/g, "const hasRegionalView = roleName.includes('regional director') || roleName.includes('regional control');");
  fs.writeFileSync(f, c);
});
console.log('Done!');
