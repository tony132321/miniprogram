# PG10-B reference UI restoration · Wave60 · 2026-10-01

## Scope and reference

Owned edits: `miniprogram/subpackages/profile/badges/badges.wxml`, `.wxss`, `.js`, dedicated `badges/assets/` only. Source read: full PG10-A/B Wave60 audit, `/private/tmp/irl-ui60-profile-ab-audit/stitch_design_system_generator/pg10_b_social_badges/code.html` and inspected original `screen.png`.

Restored page-local 16px gutters, 56px header with native capsule reservation, source surface/colors and 17px/22px header. Summary uses 16px padding/radius, 80px orb with 4px frame and translucent inner face, 20px/26px title, 13px/18px body and 11px/14px hint. XP track is empty with 10px total height and 2px inset. Showcase uses 12px padding/gaps, 40px empty icons and 17px/22px heading. Grid has three columns with 12px gaps, 16px card radius/8px padding, 56px outer icon field/48px inner icon, 15px/20px title and 11px/14px description. Closed-service copy and titles wrap; unavailable copy is retained. Two muted concepts restore low gray cards, 75% opacity and source lock glyphs. Native concept share button has 56px minimum height and 17px/22px label. Detail has 24px top radius, 16px padding, 80px icon and 20px/26px heading.

Concept correction: 滨江漫步家 uses sports / 运动活动; 首局破冰者 uses social / 社交活动. All nine remain concepts with no grants, XP, advancement or wearable state. Real activity route remains moments?filter=all; profile/privacy routes and navigation/auth behavior are untouched. Native share remains explicit concept-preview title/path.

## Official symbol provenance

19 dedicated SVG files use Google Material Symbols outlined paths at pinned commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`, wght400/GRAD0/opsz24. Explicit source FILL1 icons use fill1; muted/header/default symbols use fill0. Helper preserves glyph paths and alters root fill only. `badges/assets/material-symbols-sources.json` records upstream URL, symbol, commit and hashes. Repository license: `docs/licenses/material-symbols-Apache-2.0.txt`. No symbol fetch gaps occurred. No font binary was loaded; Plus Jakarta Sans is a preferred family with platform fallback, so exact font shape parity is unverified.

## Focused existing checks

Command: pinned node `--import tsx --test test/miniprogram-caper-badges.test.ts test/miniprogram-pg10b-badge-share-parity.test.ts test/pg10-profile-edit-badges-parity.test.ts`.

Result: 4 tests, 2 pass, 2 fail from stale expectations. `miniprogram-caper-badges.test.ts:28` expects one sports concept; source-correct category now contains two. `miniprogram-pg10b-badge-share-parity.test.ts:30` requires a text-based share icon; the source official SVG is now an image element. No tests were changed by implementer. Root owns updating these expectations and independent review.

No simulator operation, device screenshot, physical-device share delivery, full suite, Git commit or deployment was performed by this task. Source-token restoration does not constitute pixel-perfect acceptance.

Independent-review correction: more button now uses flex alignment to center the 22px official glyph vertically and horizontally inside its 44px hit area. CSS-only correction; no tests rerun. Root reports the two stale focused expectations were updated and passed 2/2.
