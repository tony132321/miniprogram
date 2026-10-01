# PG10-G 帮助与反馈参考外观修复 — Wave 59

Status: implemented; parent integration and compiled visual/click review pending.

## Scope and values

Only support.wxml, support.wxss and eight owned SVG assets in miniprogram/assets/stitch/pg10g/ were changed. Business support.js, shared common.wxss/navigation.js and other pages were not edited.

Values follow Wave 58's original PG10-G HTML token comparison at a 375px viewport: 1px = 2rpx. Page sides 32rpx (16px); header 112rpx (56px); avatar 64rpx (32px), more target 88rpx (44px); card sides 32rpx (16px), card radius 24rpx (12px). Original dynamic headerPaddingRight/statusBarHeight remain bound, including capsule clearance.

FAQ closed rows: 30rpx/42rpx (15px/21px), 24rpx vertical and horizontal padding (12px), 8rpx separation (4px), 16rpx radius (8px). Fourth long question can wrap naturally; expanded answers remain and use body-sm 26rpx/36rpx.

Tags: 26rpx/32rpx (13px/16px); horizontal padding 28rpx (14px), height 56rpx (28px), gap 16rpx (8px). Integration removed the forced break after compiled measurement found doubled vertical gap; natural flex wrapping preserves 3+2 with the actual 8px gap at the tested 402px width. Category controls stay static; only actual report tag is a button. Form: description 200rpx (100px), upload 160rpx square (80px), contact 82rpx (41px), CTA 96rpx (48px) and headline-sm 34rpx/44rpx. Hero actions are 80rpx (40px), label-md 26rpx/32rpx, with 36rpx local chat/agent outlines. Section headline-sm and body-sm also restored.

Local SVGs provide person, chat, support agent, help, edit note, add photo, contact and send outlines. Existing CSS robot remains a local outline, with no service-online indicator. No external font or network assets were added.

## Preserved behavior

All original bindtap bindings remain: back, toggleMore, goAbout, goProfile, toggleFaq, goCreate and both goReport routes. No FAQ data, payment/refund/verification boundary text or identity fence changed. AI/human buttons, textarea, contact input and submit retain disabled={{true}}. Upload remains a static unavailable view. Closed-service disclosure text remains intact.

## Focused verification

- Existing support/header/all PG10 interaction checks: 3 passed, 0 failed. Command: Node --import tsx --test --test-isolation=none --test-concurrency=1 --test-name-pattern='support|each PG10 subpage' with test/pg10-profile-navigation.test.ts, test/miniprogram-caper-profile-info-routes.test.ts and test/miniprogram-caper-profile-visual.test.ts.
- Initial broader related-file execution: 33 tests, 32 passed, 1 failed. Unrelated moments photo expectation at test/miniprogram-caper-profile-visual.test.ts:180 expects /assets/stitch/pg01_badminton_player.jpg; active sibling implementation returns /subpackages/profile/moments/assets/badminton-smash.jpg. Parent notified; no change to another owner's test.
- git diff --check: pass.
- All 8 WXML SVG references exist and parse as XML: pass.

No new tests written, full suite run, shared simulator control, commit or push.

## Parent integration checks / limits

Compiled WeChat visual screenshots and click evidence are pending parent's shared simulator pass. Review capsule/title fit after wider more/avatar targets; disabled hero labels with icons at device width; 3+2 tag layout; long fourth FAQ; upload/form and 48px CTA geometry; local SVG rendering. Click FAQ including fourth item's create action, report tag and safety report button, more/about/profile, avatar and back. Ensure disabled AI/human/form do not accept input or send. These source/focused-test findings do not establish 39-screen pixel parity or formal release.

## 根代理整合补验

后续修正、最终定向结果、CLI 包体及模拟器实点见 [Wave 59 整合证据](caper-wave59-focused-devtools-2026-10-01.md)。本报告的实现阶段结果保留，整合结果以该证据为准。
