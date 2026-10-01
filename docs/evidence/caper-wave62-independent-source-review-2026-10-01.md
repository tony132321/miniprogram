# Wave62 independent source review

## Findings

**No remaining actionable source findings in the four-page review scope.** Two visual findings were reported to the root and repaired; only their affected selectors/properties were re-read afterward. Root's compiled/rendered checks remain separate and are in progress.

The initial findings were the inconsistent source translucent header treatment and H1 hero glow radius. H1 initially used 96% opacity/no backdrop blur; all other page headers initially used 24rpx backdrop blur (12px at a 375px window). H1 glow used 48rpx (24px). Source `backdrop-blur-xl` is 24px and `blur-2xl` is 40px. Root verified the [Tailwind v3 backdrop blur](https://v3.tailwindcss.com/docs/backdrop-blur) and [blur](https://v3.tailwindcss.com/docs/blur) definitions and applied the following **six property changes across five selectors/four files**. This reviewer confirmed each affected final property, without repeating resource or business checks.

| File/line | Property | Before | Confirmed final |
| --- | --- | --- | --- |
| H1 `release-notes.wxss:4` | header background opacity | `.96` | `.8` |
| H1 `release-notes.wxss:4` | header backdrop blur | absent | `48rpx` =24px |
| H1 `release-notes.wxss:20` | intro glow blur | `48rpx` =24px | `80rpx` =40px |
| H2 `guidelines.wxss:4` | header backdrop blur | `24rpx` =12px | `48rpx` =24px |
| H `about.wxss:3` | header backdrop blur | `24rpx` =12px | `48rpx` =24px |
| H3 `open-source.wxss:4` | header backdrop blur | `24rpx` =12px | `48rpx` =24px |

## Reviewed evidence and limits

- Read the complete plan and gap audit, all four supplied HTML files, and visually inspected all four supplied PNGs. Read H1/H2 WXML, WXSS, JS, manifests, owner evidence and handoffs; read shared common styles and app styles for cascade/defaults. PNG widths differ, so geometry is compared using HTML tokens at 375px rather than raw exported PNG distances.
- One independent, read-only source check passed for H1's 23 and H2's 21 SVGs: exact pinned repository commit/URLs/names/FILL/colors, authoritative cached source SHA-256, asset SHA-256, XML, root-fill-only byte equality, and unchanged paths/viewBoxes. All 25 H1 and 21 H2 local image references exist and match the manifest sets. No SVG download or font fallback occurred during this review.
- H1 photo manifests point to the two exact URLs in original HTML, local files retain the recorded 68,054/50,874 bytes, JPEG signatures and SHA-256. The owner recorded direct, unmodified HTTP response saving. No second remote request was made; this review confirms source URL provenance and local recorded bytes, and does not independently repeat the HTTP response acquisition.
- H1 JS SHA-256 remains `73934228fc72f8f43736942518a89bf08b35ae6421c7564b3d81acf87d6bde4a`; H2 remains `9aecd0990288300443e88690a13c7405cbe7e34f2fc8811397a137bfae157cd2`, matching pre-wave audit hashes. Actual share, menu, return, create/my-activities and session-owned reporting bindings remain present. R1 closure copy stays visible; no formal version/date/update result, real AI voice, automatic payment, attendance statistics or effective legal pledge was introduced.
- Header structure retains 56px row, 44px back/share/more targets, 32px avatar, inherited `flex:1` with local `min-width:0`/ellipsis title, non-shrinking action row and existing actual capsule +8px reservation. Native button margins/padding/after borders are reset where relevant. Static source arithmetic allows the title to truncate while preserving action boxes; it does not establish rendered geometry or touch behavior in WeChat.
- After Task 1 final handoff, read complete About/H3 WXML, WXSS, JS, manifests, owner evidence and handoff. One independent read-only check passed for all 29 additional Material files: 17 About files/19 display instances and 12 H3 files/instances (original 11 plus repository `open_in_new` decoration). Names, FILL0, source colors, exact pinned source URLs/hashes and root-fill-only byte equality passed. All 20 About and 12 H3 image instances resolve to page-local assets; no cross-package reference or font fallback/proof was needed. Together with H1/H2, 73 Material files are verified, plus one original logo and two JPEGs; asset files/instances are distinct counts, and the omitted fake update-status glyph is not claimed restored.
- Infinity Spark SVG SHA-256 is `d7dfd37b60c855d02b18916b888d49e268d5b042337ef0b27c000effeba324f2`. Exact source equality passed after only documented XML casing, namespace and class normalization: original gradient/stops, both paths, circle, coordinates, widths and unused filter remain intact. CSS restores 96px outer box/56px image/64x64 viewBox/28px brand. No path gained a filter. About glyph/manifesto/list/channel/action geometry and H3 48px code box/17px heading/13px copy/11px tags/12px cards match the plan's source values; real longer copy and added true attribution naturally change height.
- About JS SHA-256 remains `71c436bcc97d4608fee8f79e3effec34c2876dd2317975f546d36e052bc3e5ad`; H3 remains `a6833658f2968a2ecb3fdf9fd2d84748d3a8ef93930bdacdac37b7efec063393`, matching pre-wave audit. Original real navigation, H3 sharing and repository copying success/failure behavior remain present. Source `Edit Profile`/`Expense Breakdown` headings are accurately adapted to the actual About/Open-source destinations, and decorative source glyphs do not create fake rating/group/website actions.
- H3 keeps five actual directly used package summaries plus one actual local Material SVG resource, counted explicitly as 5 dependencies/1 icon resource. Installed `pg@8.23.0` metadata proves Brian Carlson is the client author; `node_modules/pg/LICENSE:3` proves the exact displayed `Copyright (c) 2010 - 2021 Brian Carlson` line. Package/license SHA-256 are `e42dd36cba6e9dd8dbb6f773a2f7be8a8c3c273e18b155e42e75961a4cb8bc28`/`192b8f5c96900f04a1271dec39688655d7416c1c6ea84a508e18b50d2b6751f3`. Existing Material Apache text equals the cached official license bytes, SHA-256 `58d1e17ffe5109a7ae296caafcadfdbe6a7d176f0bc4ab01e12a689b0499d8bd`. No invented whole-project MIT/copyright/verified claim or loaded Plus Jakarta font was introduced. About official accounts/company/release facts remain unpublished or pending verification.
- No product file, shared/root evidence, test, simulator, CLI, Git operation or commit was performed. Only this local review report is owned. Root owns compiled/rendered checks and any repair. Original webfont final axes and Plus Jakarta Sans have not been verified; no pixel-perfect, true-device, release, 39-screen or whole-project completion claim follows from this review.

## Final reviewed source snapshot

| Page | WXML SHA-256 | WXSS SHA-256 |
| --- | --- | --- |
| H | `65b2fc974c3b66972c7d6c3bbc0f2b1aef71b9256364ab99f74523317e67c4f5` | `341af349ae4d8fdaff82c7c31739f55f696d944278e2a4a9e4e7b651f07f3a67` |
| H1 | `5a5b6915a5c64d69654976f3d6ff42dc0d19f42a1f03310bce666cefaad306a6` | `5c700962ac19a3ba7a5adcaa23ac8e0c8424d411bdc5f2977dea1823eb0a1857` |
| H2 | `2e397c22469dcbb89a7b302491cb2c9e7e724010bbb801b56dcbaa549a69ec88` | `6b5dad2203bfaa5b2009112807ee73b272e7486243bc1a8443f2c7147ced4927` |
| H3 | `7039ef63f088b956fb110d2cc07882d3f9d35f0a0be1f01de6dc10c223c5d8d4` | `39daff0a02757142ba24abadd8be41883bf7cd42f7ed68c1b6186fac61352e87` |

## Root follow-up: rendered ampersand correction

Root's About simulator walkthrough exposed literal `&amp;` display in the English open-source row. Root changed only two text nodes: `about.wxml:21` now wraps the existing English line in `<text decode="{{true}}">`; `open-source.wxml:9` adds that true decode binding to its existing English subtitle text. This reviewer re-read only those affected nodes and computed the two WXML/JS hashes. Both exact source strings and native true decode bindings are present; neither JS changed.

| Page | Earlier reviewed WXML SHA-256 | Root correction WXML SHA-256 |
| --- | --- | --- |
| H | `6fdb64d08e2643a289241fe85cfbf47900ffc4f3b36e7dee520bbc1434ad7177` | `65b2fc974c3b66972c7d6c3bbc0f2b1aef71b9256364ab99f74523317e67c4f5` |
| H3 | `796dbcbea020e544652a44b10bf8c726931c89f948bcad9c4428325a83625467` | `7039ef63f088b956fb110d2cc07882d3f9d35f0a0be1f01de6dc10c223c5d8d4` |

About JS remains `71c436bcc97d4608fee8f79e3effec34c2876dd2317975f546d36e052bc3e5ad`; H3 JS remains `a6833658f2968a2ecb3fdf9fd2d84748d3a8ef93930bdacdac37b7efec063393`. The final source snapshot table above now records the corrected WXML hashes; the earlier values are retained here to make the root's subsequent change explicit.

Visually inspected [the root's final About screenshot](../../../docs/evidence/images/caper-about-top-wave62-2026-10-01.png): the row visibly reads **Open Source Software & Frameworks**, with the expected ampersand. Root reports 48 About checks/8 interactions PASS. That count is root-owned evidence, not a walkthrough repeated by this reviewer. SDK `.text()` returning the original `&amp;` source string is not treated as rendered output. H3's source decode correction is confirmed; no new H3 screenshot was inspected in this follow-up. No full asset check, test suite, Git operation, CLI or simulator interaction was repeated.

## Root follow-up: Guidelines entity decoding

After the root's initial Guidelines walkthrough passed, screenshots exposed the same literal entity issue in the page title and four English section subtitles. Root reports modifying only these five text nodes, with existing strings/classes/CSS/JS/bindings retained. This reviewer checked only the five affected lines and WXML/JS hashes: each exact original string is now inside `<text decode="{{true}}">`.

| Guidelines line | Confirmed source string |
| --- | --- |
| 5 | `Safety &amp; Guidelines` inside the original `.pg10-header-title` view |
| 24 | `Punctuality &amp; Reliability` |
| 32 | `Inclusivity &amp; Boundaries` |
| 40 | `Fair &amp; Clear Accounting` |
| 48 | `Respect for Privacy &amp; Photos` |

Earlier reviewed Guidelines WXML SHA-256 was `afbca34063ec59aecb25557f7721493e4a7bf940f5902a31d0730df01bfdcb30`; root's corrected WXML is `2e397c22469dcbb89a7b302491cb2c9e7e724010bbb801b56dcbaa549a69ec88`, now recorded in the final snapshot above. Guidelines JS remains `9aecd0990288300443e88690a13c7405cbe7e34f2fc8811397a137bfae157cd2`, equal to the audit baseline. The root is obtaining targeted text/header screenshots separately; this source follow-up does not claim their rendered outcome. No resources, geometry, full walkthrough, test suite, Git, CLI or simulator operation was repeated by this reviewer.
