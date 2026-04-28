const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

function findFile(name, dir) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const f of files) {
     if (f === 'node_modules' || f === '.git') continue;
     const p = path.join(dir, f);
     if (fs.statSync(p).isDirectory()) {
       results = results.concat(findFile(name, p));
     } else if (f === name + '.ts' || f === name + '.tsx') {
       results.push(p);
     }
  }
  return results;
}

const fileCache = {};
function resolveFile(name) {
  if (fileCache[name]) return fileCache[name];
  const results = findFile(name, path.join(__dirname, 'src'));
  if (results.length > 0) {
    fileCache[name] = results[0];
    return results[0];
  }
  return null;
}

try {
  execSync('npx tsc --noEmit', { encoding: 'utf8' });
} catch (e) {
  const output = e.stdout || '';
  const lines = output.split('\n');
  let fixedCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(.*?\.tsx?)\(\d+,\d+\): error TS2307: Cannot find module ['"](.*?)['"] /);
    if (m) {
      const fileWithErr = m[1];
      const badImport = m[2];
      const importName = badImport.split('/').pop();
      const targetAbs = resolveFile(importName);
      if (targetAbs) {
        let relativeDir = path.relative(path.dirname(fileWithErr), targetAbs);
        relativeDir = relativeDir.replace(/\.tsx?$/, '');
        if (!relativeDir.startsWith('.')) relativeDir = './' + relativeDir;
        
        let content = fs.readFileSync(fileWithErr, 'utf8');
        // Simple replace for the bad string
        const regex = new RegExp(`['"]${badImport}['"]`, 'g');
        if (regex.test(content)) {
           content = content.replace(regex, `'${relativeDir}'`);
           fs.writeFileSync(fileWithErr, content);
           fixedCount++;
        }
      }
    }
  }
  console.log(`Auto-fixed ${fixedCount} import errors`);
}
