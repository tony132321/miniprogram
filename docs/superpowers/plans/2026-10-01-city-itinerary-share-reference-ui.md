# Wave 63: city / itinerary / share reference UI

## Objective and accepted scope

Continue the user's accepted reference UI restoration on existing Project IRL R1, using all three newly committed independent gap audits and original HTML/PNG. Preserve real functions and R1 boundaries. Three disjoint implementations run concurrently; root alone runs shared WeChat CLI, Automator and computer use. No full local/business/CI suites; no new reversible style mirror tests. Each completed batch is committed and uploaded using `[skip ci]`.

Implementation baseline: local `6be9ceb2160b8a3ff142948b947d7f94b8765cd1` (Wave 62 tree `7a0b0ddbcce8714a47e8beff18a6ef5b295d6fdb`). Its immutable upload can proceed while agents edit their own Wave 63 files. Do not stage or change the supplied untracked engineering package.

Source root `/private/tmp/irl-stitch-original/stitch_design_system_generator/`, directories `pg02_loc_city_selection`, `_1`, `_3`. Original PNG widths vary; use HTML explicit CSS tokens at 375px=750rpx. Read complete HTML and PNG, respective audit and existing page code before implementing. Raw sample names/dates/fields/statuses are not real API facts. Fonts and final webfont axes remain a separate unverified parity boundary.

## Task 1: city page

Owner files only `miniprogram/pages/city/city.{wxml,wxss,js}`, its new `assets/`, exact `place` fallback proof `docs/design-sources/material-symbols-place-fill0/`, and `docs/evidence/caper-city-reference-ui-wave63-2026-10-01.md`. Do not edit city dataset/utils, JSON, shared styles or other pages.

Read `caper-city-reference-gap-audit-wave63-2026-10-01.md`. Restore 56px sticky row beneath actual status bar, fixed noninteractive status cover, 44px back/more, 32px blue avatar, 17px true Chinese title and actual capsule+8px reservation. Search gets independent sticky container immediately beneath header, 44px input/r12/15px text, exact search20/close16. Source blur-xl24px is48rpx, not24rpx.

Restore source content rhythm, cards, 44px popular cells/gap12, 48px city rows/15px names, accurate badges/provinces, search results/empty state and footer. Preserve existing query focus/clear/return/storage and manual-city/no-GPS semantics. Current hot city list and nine A/B/C/D/G/H/N/S/W groups unchanged. Source fake application toast/check_circle/add_circle slots are not implemented; existing real searchMoreCities action may use a separately recorded search16 blue variant.

Two-layer alphabetical rail: source right4px, top144px, bottom80px, outer padding8x4, inner padding4/gap4, 20px letters/11px text. Adapt top to actual status+144px and document this platform allowance. Preserve narrow right lane and avoid covering header/search/native capsule. Adding sticky layout may cover jump destinations: only adjust this page's jumpToLetter scroll offset if needed to keep target heading below actual sticky region. Use native selector geometry/viewport scroll, not a new city selection algorithm. Document this specific necessary JS change separately from unchanged data behavior.

Use exact source Material names/FILL/color/size; FILL1 near_me/location_on/auto_awesome. Fixed-name place is404; root adapted temporary font helper to this page. City owner alone may call the existing official exact-name helper for place, retaining CSS/font/GSUB/hash/version proof. No alias to location_on. Make each asset page-local and manifest-driven. Do not modify the shared temporary pipeline or any other fallback proof. Named helper pinned script `/private/tmp/irl-material-symbols-wave60/export_symbol.py`; static font helper same root `export_font_symbol.py`. No font distributed in main package, only exported SVG.

Acceptance: one necessary source/XML/refs/hash/FILL/JS-diff selfcheck; root later verifies sticky/capsule/search input/clear focus, real letter jump heading visible and one manual city selection returning with actual saved value. No new design/geometry mirror tests. Existing focused search/selection tests only if JS changes actually require them.

## Task 2: itinerary page

Own only `miniprogram/subpackages/activity/itinerary/itinerary.{wxml,wxss,js}`, new `assets/`, `docs/evidence/caper-itinerary-reference-ui-wave63-2026-10-01.md`. JS exception is only a local headerPaddingRight helper/data/onLoad/onShow layout field; all existing business function logic must retain baseline behavior.

Read corresponding gap audit. Restore source main title20/26/w700, subtitle13/18, p16 body, facts p12/gap10, 28px/r8 icon boxes and18px exact glyphs. Date supplemental11/14/w700 differs from location/fee13/18/w400. Retain176px cover and category JPEG bytes; gradient to-top white100% /on-surface20% /transparent. Exact timer FILL1 16pink, verified F0 15primary, calendar_today F0 18blue, location_on F0 18#4d5d00, payments F0 18violet, info F0 18variant. Restore source badge padding and32px truth icon/20px FILL1 check_circle as decoration of existing honest unsynced statement.

Restore later heading17/22, cardp12/gap12/r16, date48x48/r12, title17/22, details13/18, status11/14 p2x8 capsule. If ensuring original pink/violet alternate date boxes, bind existing for-index class explicitly without modifying true status text or creating fake state assignments. Preserve existing details arrow as actual navigation adaptation. Preserve all true field/condition/registration/check-in/detail handlers and data-id. No synthetic roster/calendar-sync/PASS facts; no filler future events.

Use page-local exact official Material assets; replacing already reviewed CSS person is optional and only done if necessary as a source inventory correction, never presented as new functionality. The implementer independently confirmed this page has fixed200rpx CSS reservation, not a JS capsule helper. Add local exact actual capsule+8px helper using existing public info-page pattern, data and onLoad/onShow update plus WXML padding only; preserve load/request/time/identity/route logic. Header restores exact source56/44/32/gutter16 with this actual reservation; document difference from Wave56 already completed white person/route. Do not alter navigation logic.

Acceptance: one necessary exact source/resource selfcheck and explicit minimal header-only JS diff proof. Root later verifies actual own primary and later records, layout and one same-id destination/back. No repeat of already verified business-date/identity matrix unless a new concrete issue emerges. If local account has fewer actual events, report evidence limitation rather than create fake cards.

## Task 3: invite share page

Own only `miniprogram/subpackages/activity/share/share.{wxml,wxss,js}`, new `assets/`, existing `test/miniprogram-caper-share.test.ts` only for actual page canvas dimension assertion, and `docs/evidence/caper-share-reference-ui-wave63-2026-10-01.md`. Do not edit QR vendor, poster test, backend, common styles or completed sheet icon files.

Read corresponding audit; preserve all canShare/shareReason/expiry/session/visibility gates, masked city, actual fields, 32-character base64url token, three copyInvite bindings, existing sheet and native share/poster flow. Restore source56px header/44px return32avatar/gutter16 with existing actual capsule reservation; true content naturally wraps.

Ticket r16, original blue/lime/violet8px top stripe, source20px event title, true count capsules, facts p14/gap10/r12/28 icon boxes/15px main text. Add decorative28px circles at left/right-14px around source tear divider, retain overflow safely. Token full-width #efedf3 r12 p12 gap8 key18 with min-width0 and word-break/overflow-wrap; never truncate/inject spaces into token. May make sheet token wrap too while retaining its copy action and completed sheet resources.

Root selects source-sized real QR: only drawInviteQr page call changes200→160 and corresponding visible canvas inline160x160; separate white wrapperp12/r16 totals184x184. Keep paintInviteQr same algorithm, levelM/count+8/four-module quiet area; keep poster200 and offscreen360x600. No source decorative SVG/IRL overlay, no CSS scaling200 coordinates to160, no crop. Update existing share test's page white-fill dimension only and report meaningful existing token-forwarding/drawing test. Run this single relevant file if needed, not full suite. Root must additionally decode current actual screenshot at160; mock canvas unit test alone cannot prove decode.

Restore three info cards p14/r12/gap12,36px icon boxes20glyph,17px titles13px descriptions. Exact source names/FILL/color inventory from audit; F1 sports_tennis/bolt/groups_2/receipt_long. Do not create sample Luna host capsule without actual existing data. Do not assert immunity to approval, automatic reservation or generated poster before it exists. New source photo_camera may decorate accurate existing poster instruction only, not a fake success banner.

Acceptance: one necessary source/resource selfcheck, explicit minimal JS diff proof (draw parameter only), existing share file relevant check and preserved gates/QR vendor/poster bytes. Root later verifies source geometry, current eligible real token and copy/sheet, actual160 QR decode, and existing closed state; only changed route checks.

## Integration and ownership

Three tasks have no shared product writes. Assets each own manifest; fixed-source cache helper is already atomic. Missing exact name beyond place must be reported to root before touching shared fallback proof. Each owner selfchecks only its scope, writes scoped evidence, then freezes and sends handoff with hashes/counts and explicit limitations. No owner runs Git, CLI, Automator or computer use, no owner edits shared acceptance matrix.

After handoff use a new independent source reviewer across completed scope. Root integrates only concrete review fixes, syncs complete source to existing clone excludingconfig.js/.DS_Store, runs sequential bounded changed-page SDK checks, visually reads PNGs and uses CUA as available, final CLI preview and package quota. No full suite or repeated unrelated QA. Record local/simulator/native/external evidence separately. Root alone commits completed source/evidence `[skip ci]`, uploads immutable Git blobs/tree/commit to authorized GitHub branch, checks same tree and updates existing draftPR#1; no merge.
