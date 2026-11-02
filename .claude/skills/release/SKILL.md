---
name: release
description: Release procedure — version bump, changelog, full verification, build, static deploy and production smoke test. Only run when the user explicitly asks to release or deploy.
disable-model-invocation: true
argument-hint: "[patch|minor|major]"
---

# Release ($ARGUMENTS)

Spec: `docs/12-deployment.md`.

1. Confirm the working tree is clean and on `main`. Stop if not.
2. Run the `verify` checklist in full, including `pnpm test:e2e`.
3. Bump versions (`$ARGUMENTS`, default patch) in root and package `package.json` files. Update `CHANGELOG.md` from commits since the last tag, grouped as เพิ่ม / แก้ไข / เปลี่ยนแปลง, written in Thai for users.
4. `pnpm build`. Check bundle size of `apps/web/dist` against the previous release; flag growth > 15%.
5. Show the user the changelog and versions and **wait for confirmation** before tagging or deploying.
6. Commit `chore(release): vX.Y.Z`, tag `vX.Y.Z`, push with tags (CI deploys).
7. After deploy: open the site, attach one `.sgp.txt` from `seed/structured-prompts/`, load a sample image, export once; then turn the network off, reload, and repeat (PWA offline check).
8. Report the release URL, version and smoke-test results.
