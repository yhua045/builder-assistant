const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walkDir(p, callback);
    } else if (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js')) {
      callback(p);
    }
  }
}

const rootDir = path.join(__dirname, 'src');

walkDir(rootDir, (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // match jest.mock('../../src/path', ...) or similar
  content = content.replace(/jest\.mock\(['"]((?:\.\.\/)+)src\/(.*?)['"]/g, (match, dots, relPath) => {
    changed = true;
    const absTarget = path.join(__dirname, 'src', relPath);
    let relativeDir = path.relative(path.dirname(file), absTarget);
    if (!relativeDir.startsWith('.')) relativeDir = './' + relativeDir;
    return `jest.mock('${relativeDir}'`;
  });

  if (changed) {
    fs.writeFileSync(file, content);
  }
});
