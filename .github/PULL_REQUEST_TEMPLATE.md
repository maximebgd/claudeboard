<!--
Thanks for contributing to claudeboard! Please read CONTRIBUTING.md first.
Keep PRs focused: one logical change per PR.
-->

## What & why

<!-- What does this PR change, and why? Link related issues, e.g. "Closes #123". -->

## Type of change

- [ ] 🐛 Bug fix
- [ ] ✨ Feature
- [ ] 📝 Docs / translation
- [ ] ♻️ Refactor / chore

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Filesystem access goes through `safeResolve` (no traversal outside `CLAUDE_DIR`)
- [ ] Any new write to `~/.claude` is gated by `isAllowed` **and** added to `PERMISSION_SCHEMA`
- [ ] Deletes go through the trash (`moveToTrash`), never destructive
- [ ] Any new user-facing string has a key in **both** `fr` and `en` (`lib/i18n/translations.ts`)
- [ ] Commit messages follow Conventional Commits

## Screenshots

<!-- For UI changes, add before/after screenshots. -->
