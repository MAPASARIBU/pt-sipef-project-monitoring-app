const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('./src/app', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Fix getUnitName implementations
    if (content.includes('const getUnitName = ')) {
      content = content.replace(
        /return u \? u\.name : unitId;/,
        'return u ? (u.abbreviation || u.name) : unitId;'
      );
      content = content.replace(
        /return u \? u\.name : 'Unknown';/,
        "return u ? (u.abbreviation || u.name) : 'Unknown';"
      );
      content = content.replace(
        /=> data\.units\.find\(u => String\(u\.id\) === String\(unitId\)\)\?\.name \|\| 'Unknown'/,
        "=> { const u = data.units.find(u => String(u.id) === String(unitId)); return u ? (u.abbreviation || u.name) : 'Unknown'; }"
      );
      changed = true;
    }

    // Fix inline data.units.find
    const inlineRegex = /\{data\.units\.find\((?:u|x) => String\((?:u|x)\.id\) === String\((?:p|proj)\.unitId\)\)\?\.name \|\| (?:p|proj)\.unitId\}/g;
    if (inlineRegex.test(content)) {
      content = content.replace(inlineRegex, "{(data.units.find(u => String(u.id) === String(p.unitId))?.abbreviation || data.units.find(u => String(u.id) === String(p.unitId))?.name) || p.unitId}");
      changed = true;
    }

    // tender/page.tsx specific
    const inlineTenderRegex = /\{data\.units\.find\((?:u|x) => String\((?:u|x)\.id\) === String\(p\.unitId\)\)\?\.name \? \([^)]+\) : ''\}/g;
    if (inlineTenderRegex.test(content)) {
      // e.g. {data.units.find(u => String(u.id) === String(p.unitId))?.name ? (...) : ''}
      content = content.replace(inlineTenderRegex, (match) => {
          return match.replace(/\?\.name/, '?.abbreviation || data.units.find(u => String(u.id) === String(p.unitId))?.name');
      });
      changed = true;
    }

    // check other occurrences
    content = content.replace(
      /data\.units\.find\(u => String\(u\.id\) === String\(p\.unitId\)\)\?\.name/g,
      "(data.units.find(u => String(u.id) === String(p.unitId))?.abbreviation || data.units.find(u => String(u.id) === String(p.unitId))?.name)"
    );

    if (content !== fs.readFileSync(filePath, 'utf8')) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated ' + filePath);
    }
  }
});
