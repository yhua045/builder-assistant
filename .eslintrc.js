module.exports = {
  root: true,
  // ignore git worktree folders (they contain other branches and tests)
  ignorePatterns: [
    "worktrees/**"
  ],
  extends: '@react-native',
};
