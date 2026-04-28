---
description: Audit commit hook automation for Node.js projects
argument-hint: (no arguments - interactive)
---

## General Guidelines

### Output Style

- **Never explicitly mention TDD** in code, comments, commits, PRs, or issues
- Write natural, descriptive code without meta-commentary about the development process
- The code should speak for itself - TDD is the process, not the product

# Commit Hook Automation Checklist (Node.js)

Scan the Node.js repository and report what commit automation is in place.

**User arguments:**

Commitlint-checklist: $ARGUMENTS

**End of user arguments**

## Checks to Scan

Scan the repository for these configurations (do not display this list to user):

**🔧 Infrastructure**

- Husky: `.husky/`, `package.json` → `"prepare": "husky"`
- Pre-commit hook: `.husky/pre-commit`
- lint-staged: `lint-staged.config.*`, `.lintstagedrc.*`, or `package.json` lint-staged key

**🧹 Code Quality**

- Linting: `eslint.config.*`, `biome.json`, `.eslintrc.*`
- Formatting: `.prettierrc*`, `biome.json`
- Type checking: `tsconfig.json` + lint-staged runs `tsc --noEmit`
- Knip: `knip.json` or knip in scripts
- jscpd: `.jscpd.json` or jscpd in scripts

**🔒 Security**

- Secret scanning: `.secretlintrc.json`, secretlint in dependencies

**📝 Commits**

- Conventional commits: `.husky/commit-msg`, `commitlint.config.*`, `@commitlint/*` in deps

**🧪 Testing**

- Pre-commit tests: lint-staged or pre-commit hook runs test command
- Coverage thresholds: vitest/jest config with coverage thresholds

## Output Format

Display ONLY this summary format (no tables, no detailed breakdown):

```
✅ Passing:
  🔧 Infrastructure: Husky, pre-commit hook, lint-staged
  🧹 Code Quality: Linting, formatting, type checking, Knip, jscpd
  🧪 Testing: Pre-commit tests, coverage thresholds

❌ Missing (2):
  • Secret scanning (secretlint)
  • Conventional commits (commitlint)

📊 10/12 checks passing
```

Omit categories with no passing checks from the "Passing" section.

## Follow-up

After the summary, tell the user:

> For working examples of most items above, see [wbern/claude-instructions](https://github.com/wbern/claude-instructions) on GitHub.
>
> Would you like help implementing any of the missing checks?
