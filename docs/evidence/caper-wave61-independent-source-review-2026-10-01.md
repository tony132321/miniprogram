# Independent review — PG10-C / F / G official symbols, Wave 61

Date: 2026-10-01. Reviewer: ui61_review. Reviewed working tree against `5361bb67c71712848a4e72aaf435612edcad79f4`.

## Findings

No P1/P2 findings in the scoped code, official-symbol provenance, asset references, or preserved closed-feature boundaries. This is a source and asset review; root-owned simulator checks and integration gates remain separate.

## Inputs read

- Full plan `docs/superpowers/plans/2026-10-01-pg10-c-f-g-official-symbols.md` and Wave61 three-page gap audit.
- All three page implementation evidence records and Task 1/2/3 SDD handoff reports.
- Scoped product diff, current C/F/G WXML/WXSS/JS, unchanged shared common.wxss/navigation.js, font fallback helper and source proof.
- Three original HTML documents and PNGs in `/private/tmp/irl-ui61-symbol-audit/pg10_{c,f,g}/`; independently recomputed all six SHA-256 values against the gap audit. PNGs visually inspected.

## Fresh independent verification

| Check | Result |
| --- | --- |
| Asset inventory / exact names / FILL / colors | 39 SVGs: C17, F10, G12. Manifest and directory inventories match the audited exact-symbol map. |
| Pinned official SVGs | 38 assets, 31 unique live primary `raw.githubusercontent.com/google/material-design-icons/bd8cb85bd4bad964fe6918f79665bb40c3a8efef/...` URLs. Each live body matches private cache and recorded source SHA-256. Reapplying only the root fill replacement reproduces the entire delivered asset bytes, including all path and other SVG attributes. |
| favorite_border unavailable SVG | Independently requested the accurate pinned `symbols/web/favorite_border/materialsymbolsoutlined/favorite_border_24px.svg`; HTTP 404 confirmed. No alias substituted. |
| favorite_border official static font | Saved CSS URL requests Outlined opsz24/wght400/FILL0/GRAD0 and exact `icon_names=favorite_border`. Saved CSS hash/font URL and TTF hash match source.json and C manifest; live gstatic TTF equals saved bytes. Font is static, Version 2.972, 960 UPEM. |
| favorite_border GSUB and outline | Cmap sequence for every character of `favorite_border` has one exact GSUB ligature match, `uniE87D`, in lookup 0. Feature record is `rlig`, used by default DFLT and latn language systems. Drawing that glyph with SVGPathPen through TransformPen `(1,0,0,-1,0,0)` reproduces full heart.svg bytes and SHA-256 `671480432ad1009e43ac5c2bafdf9f2a4a948be7bffd0bdae4b413257bb751cd`. |
| Local references / modes | All C17/F10/G12 SVGs are consumed by local WXML or the unchanged C filter icon/activeIcon pairs. No missing or orphaned manifest entry. Every WXML image declares aspectFit or the retained photo aspectFill. |
| Preserved JS and photos | All three page JS files, common.wxss and navigation.js, eight moments JPEGs, and photo reference-sources.json are byte-identical to base. |
| Event and state contracts | All bind/catch handlers, disabled attributes, wx branches and loops match base; the sole new C wx:if is the decorative badminton sports_tennis condition. G retains five disabled controls. |
| Legacy G cleanup | `git grep` at base confirms all eight old main-package PG10-G SVG paths were consumed only by support WXML. Current miniprogram rg finds zero legacy references; all eight old files are absent. |
| Whitespace | Fresh scoped `git diff --check` exits 0. |

The asset checks ran as temporary read-only Python commands, using the existing ephemeral FontTools library for font inspection. No test file or product script was added.

## Manual source assessment

- Names are exact: groups, crown, camera_roll, cloud_download, face_retouching_natural, forum, help_center, edit_note, add_photo_alternate and contact_phone retain their audited names. C filter active assets independently carry FILL1 white; normal assets are FILL0 gray. C pink favorite and F auto_awesome/G smart_toy are FILL1. Purple/green/lime fills match the original HTML tokens.
- Every delivered glyph has the audited CSS display box: shared header 48/44/36rpx, 88rpx return touch area, 64rpx avatar; C filter32, summary44, pink28, pack28, sport28, footer36, privacy44 and CTA40rpx; F body36/44/44/44/40/40/28rpx; G body52/36/36/40/40/40/52/40/40rpx. Replaced CSS person/robot/storage/device/document/shield/refresh outlines are removed. G FAQ image retains `is-open` 180-degree rotation.
- Header padding continues to use actual capsule left/window width plus 8px, with the pre-existing 112px fallback. All three titles retain min-width 0 and ellipsis; action areas remain fixed. Header y starts at statusBarHeight. F/G fixed covers explicitly pass pointer events, and C cover ends at statusBarHeight above the header controls. No apparent new obstruction is present in source geometry. Actual capsule/hit/scroll behavior requires root's runtime evidence.
- C glyph decorations retain “示意配图”, “照片待开放”, “活动相册未开放”, closed pack/like/comment/face/upload states, and same-ID openActivity bindings. No fabricated members, likes, comments or recollection rates were introduced.
- F refresh remains bound only to refreshStorage; READY, actual lastReadAt and UNAVAILABLE branches are preserved. The broom is decorative on “重新读取设备存储”; no cleanup checkbox, destructive operation, success sheet/toast, or guarantee was introduced.
- G FAQ and create/report/about/profile routes are preserved. AI/human support, feedback, uploads and contact collection remain closed. No online dot, response promise, service hours, fake contact, upload preview or success toast was introduced. Existing safety `!` remains a documented R1 adaptation, not an original Material symbol claim.

## Review boundary

This reviewer did not run business/full suites, compilation CLI, simulator, native app writes, Git commits or uploads, and changed only this isolated review report. Official glyph source checks do not establish the original browser's final font axes, per-pixel parity, physical-device behavior, all 39-screen completion or external/production acceptance.

## Temporary runtime-script review addendum

At FG script author's request, read `/private/tmp/caper-wave61-fg.cjs` and the installed SDK Element/Page method implementations without connecting to the simulator. One evidence blocker was reported to the author and root: faq() scrolls the fourth answer beneath the sticky header for a screenshot, then taps its preceding trigger without restoring trigger visibility. The requested correction is to scroll/reacquire that trigger before its closing tap. This is a verification-script issue, separate from the reviewed product changes. No other concrete SDK/navigation/watchdog blocker was identified from static inspection. Author/root own script repair and actual execution.

Script correction independently re-read: every FAQ closing gesture now first scrolls the corresponding nth-child trigger below the sticky header, then reacquires and taps it. The identified static evidence blocker is resolved; runtime execution remains root-owned.

## Final root correction independently checked

Compiled screenshots exposed G return glyph centered in its 44px target. Root changed only justify-content to flex-start at support.wxss:76. Independent ui62_about_audit re-read original pg10_g code.html:10 and current CSS: original justify-start, current 88rpx target and 48rpx icon now agree. Root final narrow G header scenario PASS: actual icon left equals target left, target remains44px scaled, capsule clearance8px, sticky header/menu/back route and exceptions0. Final screenshots and measurement supplement are separate from the earlier full G route record.
