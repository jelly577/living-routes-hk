# C → A / B 待沟通事项（攒着一起说）

## 给 A
- [ ] 讲稿已放在 `src/content/stories.js` + `storyTranslations.js`，`places.js` 只改了一行：`stories: storiesByPlace[place.id] ?? createStoryTracks(...)`。
- [ ] 中环街市、终审法院、跑马地只有 medium；`getStories` 请求 short/long 时会回退到 medium，但返回的 `length` 仍是请求值。实际长度看 `story.length`。
- [ ] 每篇讲稿新增 `localized.{en,zh-CN,zh-HK}` 和 `languages`；`getStoryForJourney()` 需要加 `language` 参数，或在返回前调用 `localizeStory(story, language)`。
- [ ] 讲稿新增字段：`placeId`、`track`、`trackLabel`、`length`、`language`、`reviewStatus`、`disclosure`（Civilian）。字段层级未改。

## 给 B
- [ ] 播放器需要语言切换（EN / 普通话 / 粤语），并显示 `sourceUrls` 和 Civilian 的 `disclosure`。
- [ ] 显示时长请用 `story.durationSec`（估算值，之后会换成真实音频长度）。
- [ ] 确认地图有没有写死五个地点（关系到以后加地点的成本）。
- [ ] 核对：利东街、蓝屋离城巴 1 号线实际行驶路线的距离，“车上听到时人在附近”是否成立。

## 需要团队一起定
- [ ] 以后是否在 1 号线上加地点（只加不换），要加的话一次性定清单。
- [ ] Pitch 里“任意巴士路线 + 来源检索 + AI 改写 + 人工审核”作为扩展愿景。

## 图片包（2026-09-26）
- [ ] 给 B：五个地点的 `image` 已填好、`status: 'verified'`，详见 `docs/C-PLACE-IMAGES.md`。
- [ ] 给 B：`attributionRequired: true` 的图（CC BY / BY-SA）必须在图下显示 `credit` 署名小字。
- [ ] 给 B：新增可选 `gallery`（今昔对照，按时间排序），第一版可不显示；E6 为火灾现场图，带 `contentWarning`，不要自动展示或作封面。
- [ ] 给 A：`places.js` 新增 `gallery` 字段（默认空数组）；如要做“今昔对比”展示，再一起定 UI。

## 联调观察（2026-09-26，本地 npm run dev）
- [ ] 给 B：播放器目前只显示讲稿 `title`，没显示正文 `text` 和来源 `sourceUrls`；Official 内容规定“必须显示来源”。
- [ ] 给 B：Civilian 提示语是写死的 “Demo civilian sample…”，建议改为读取 `story.disclosure`（已有三语版本）。
- [ ] 给 A/B：播放器固定 `placeId: 'central-market'`、`remainingTimeSec: 45`，接上地图触发后才能看到其他地点和 short/long。

## TTS / 音频（2026-09-28）
- [ ] 给 B：播放器接 `src/services/ttsService.js` 的 `createNarrator()`：`play(story, language)` 会先停掉旧的再播新的；`pause / resume / stop`；`onStateChange` 返回 `loading / playing / paused / ended / idle / text-only`，`text-only` 时仍显示讲稿文字。
- [ ] 给 B：进度条可直接用 `onProgress(0–1)`，代替现在的假计时器；关闭播放器时调用 `stop()`。
- [ ] 给 A：备用音频在 `public/audio/`（由 `node scripts/generate-audio.mjs` 在 Mac 上生成），`manifest.json` 记录每段真实时长，可替换 `durationSec` 的估算值。
- [ ] 给 A：项目根目录新增 `tts-test.html`（本地试听页，不进正式打包）。

## 个性化（2026-09-28）
- [ ] 给 A：`getStoryForJourney()` 已接入 C 的 `src/services/personalization.js`，签名不变，只新增可选参数 `language`（'en' | 'zh-CN' | 'zh-HK'，默认 'en'）。smoke test 全过。
- [ ] 给 A：返回值里 `length` 仍是按剩余时间算出的档位（保持原规则和测试不变）；**实际播放的长度看 `story.length`**。中环街市、终审法院、跑马地只有 medium，所以 10 秒时 `length` 是 short、`story.length` 是 medium。
- [ ] 给 A/B：新增 `personalization` 字段：`fitsRemainingTime`（false = 剩余时间不够读完，建议只显示文字或跳过语音）、`hookApplied`、`interestFocus`、`recommendedTrack`（按兴趣建议 official / civilian，只做推荐，不自动切换）。
- [ ] 给 B：播放器现在写死 `placeId: 'central-market'`、`remainingTimeSec: 45`，接地图时请传入当前节点、真实剩余时间、用户兴趣和语言。
