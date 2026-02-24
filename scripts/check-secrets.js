#!/usr/bin/env node
const { execSync } = require('child_process');

function getStagedFiles() {
  const out = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

const forbiddenFilename = /^\.env(?:$|\.)/i;
const forbiddenContentPatterns = [
  /GROQ_API_KEY\s*=/i,
  /gsk_[A-Za-z0-9_-]{16,}/,
];

let blocked = false;
const staged = getStagedFiles();
if (staged.length === 0) process.exit(0);

for (const file of staged) {
  if (forbiddenFilename.test(file) || file.includes('/.env')) {
    console.error(`[secret-check] Refusing to commit env file: ${file}`);
    blocked = true;
    continue;
  }

  try {
    const content = execSync(`git show :${file}`, { encoding: 'utf8' });
    for (const p of forbiddenContentPatterns) {
      if (p.test(content)) {
        console.error(`[secret-check] Potential secret detected in ${file}: ${p}`);
        blocked = true;
      }
    }
  } catch (e) {
    // binary files or removed files may fail; skip them
  }
}

if (blocked) {
  console.error('\nCommit blocked by secret-check pre-commit hook. Remove sensitive data and try again.');
  process.exit(1);
}

process.exit(0);
