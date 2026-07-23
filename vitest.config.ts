import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Every module in this project is developed in a nested git worktree under
    // .claude/worktrees/<name> (see superpowers:using-git-worktrees). Vitest's default
    // excludes don't cover that path, so any worktree present on disk gets its test files
    // discovered a second time when the suite runs from the main checkout root, silently
    // doubling every count (seen firsthand: 97 real tests reported as 194).
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**'],
  },
})
