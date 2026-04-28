const fs = require('fs');
const path = require('path');
function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      if (!dirPath.includes('node_modules') && !dirPath.includes('.git')) {
        walkDir(dirPath, callback);
      }
    } else if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
      callback(dirPath);
    }
  });
}
walkDir(path.join(__dirname, 'src'), (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  // TODO rules
  if (changed) {
    fs.writeFileSync(file, content);
  }
});
