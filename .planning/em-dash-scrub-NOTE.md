# Em dash scrub: chore/avoid-ai-writing

**Branch:** chore/avoid-ai-writing
**Date:** 2026-05-27
**Scope:** Remove em dashes from all user-facing / outbound text in app/

## Before / after count

Em dashes (—) in scoped outbound-text files:

| File | Before | After |
|------|--------|-------|
| app/content/changelog.ts | 11 | 0 |
| app/content/blog/how-reporadar-scores-repos.ts | 4 | 0 |
| app/content/blog/why-we-built-reporadar.ts | 8 | 0 |
| app/content/blog/index.ts | 1 | 0 (comment only) |
| app/lib/notifications.ts | 1 outbound | 0 |
| app/api/contact/route.ts | 2 outbound | 0 |
| app/api/deploy/route.ts | 2 user-visible in system prompt | 0 |
| app/api/notifications/verify/route.ts | 2 (HTML titles) | 0 |
| app/api/notifications/unsubscribe/route.ts | 2 (HTML titles) | 0 |
| app/(site)/_components/ContactForm.tsx | 2 outbound | 0 |
| app/(site)/_components/SuggestionsBoard.tsx | 3 outbound | 0 |
| app/(site)/contact/page.tsx | 2 visible | 0 |
| app/(site)/suggestions/page.tsx | 2 visible | 0 |
| app/(site)/changelog/page.tsx | 1 (title) | 0 |
| app/(site)/blog/page.tsx | 1 (title) | 0 |
| app/(site)/blog/[slug]/page.tsx | 2 (titles) | 0 |
| app/layout.tsx | 3 (meta titles) | 0 |
| app/components/FeedbackWidget.tsx | 1 visible | 0 |
| app/components/InteractMenu.tsx | 1 visible | 0 |
| app/components/Footer.tsx | 1 (aria-label) | 0 |
| app/components/DeployForm.tsx | 4 visible | 0 |
| app/components/FilterPanel.tsx | 1 visible | 0 |
| app/components/TagsPanel.tsx | 4 visible | 0 |
| app/components/RepoRadarApp.tsx | 2 visible | 0 |
| app/components/RepoCard.tsx | 1 (title attr) | 0 |
| app/components/PriorityBar.tsx | 1 (title attr) | 0 |
| app/components/HeaderControls.tsx | 3 visible | 0 |
| app/components/TalkPanel.tsx | 1 visible | 0 |
| app/lib/types.ts | 1 visible | 0 |

**Total outbound em dashes removed: ~66**

Remaining em dashes in the app/ tree are in code comments only (developer-facing),
not in any string that reaches the user.

## RSS parser update

Updated regex in `app/(site)/changelog/rss.xml/route.ts` from:
```
/^##\s+(\d{4}-\d{2}-\d{2})\s+[—-]\s+(.+)$/
```
to:
```
/^##\s+(\d{4}-\d{2}-\d{2})\s+[:—-]\s+(.+)$/
```
Accepts both the new colon format and old em dash format.
Build shows `○ /changelog/rss.xml` (static, as before).

## Commits

- fc8c2f9: chore(content): remove em dashes from changelog + blog content
- bb0dc11: chore(email): remove em dashes from outbound email bodies + subjects
- 77fdddd: chore(pages): remove em dashes from page titles + visible UI copy
- 709b5f1: chore(ui): remove em dashes from visible dashboard UI strings
- 756ff13: chore(agents): add Writing style (NON-NEGOTIABLE) section to AGENTS.md

## Verification

- `npm run build` exits 0
- `/changelog/rss.xml` still renders as `○ (Static)`
- Targeted ESLint: no new errors (2 pre-existing set-state-in-effect in RepoRadarApp.tsx unchanged)
