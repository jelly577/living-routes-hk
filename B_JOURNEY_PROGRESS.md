# B 同学 · 地图与旅程层进度笔记

> 项目：Living Routes HK（城市声线）· 城巴 1 号线语音导览
> 负责：B 同学（lemon）· 地图层 + 旅程层（试乘 / 速度对比 / 播报）
> 更新时间：2026-09-30

---

## 一、我们俩做了哪些事（总览）

一句话：把「定位 + 路线 + 语音连播 + 试乘 + 速度对比 + 自适应画像」拼成了一条能跑的旅程链路，并针对试乘播报做了这一轮的收尾打磨。

| 模块 | 做了什么 | 关键文件 |
|------|----------|----------|
| 旅程引擎 | 沿路线 `cum` 累计里程，算出最近站点 → 分段 → 到站连播 | `src/map/MapViewGoogle.jsx` |
| 试乘（demo） | 自动从一站开到下一站，进度条**可拖动**但**仍自己跑** | 同上 |
| 速度对比 | 英文模式并排展示「快/慢」两档 → 不同站距时长 → 不同脚本长短 | `src/App.jsx` 的 `DemoNarration` |
| 语言切换 | English / Cantonese 粤语 / Mandarin 普通话，顺序 + 名称改好 | `src/App.jsx` |
| 播报框可收起 | 收成底部小条，不挡地图/蓝点 | `src/App.jsx` + `styles.css` |
| 自适应画像 | 四项兴趣（建筑/文化/食物/自然）→ 比例 → 注入 1–2 句兴趣句 | `src/services/profileService.js` |
| 内容 | 补了若干站的短/长英文脚本 + 食物 hook | `src/content/stories.js`、`interestHooks.js` |

---

## 二、这一轮（收尾）具体改了什么

1. **试乘播报合并**：以前试乘时会同时冒出「旧播报 + 速度对比卡」两份声音，现在只剩一张卡。
   - 英文：左列「快」（自动先播）+ 右列「慢」做对比。
   - 粤语 / 普通话：只播单一版，用 C 同学已有的翻译脚本，**不做快慢对比**。
2. **默认自动连播英语第一版**：每到一站自动播「快」那一列，不用手动点。
3. **语言顺序**：English → Cantonese 粤语 → Mandarin 普通话；按钮名也改成 `English` / `Cantonese 粤语` / `Mandarin 普通话`。
4. **去掉慢/常/快选择器**：既然有对比卡，手动选速度就删了。
5. **播报框可折叠**：点 ⌃ 收成一条小横条（▶/⏸ + 展开），想专心看地图时用。
6. **试乘进度条可拖动**：能手动拖到任意位置，松手后继续自动跑。
7. **模式切换清理**：去掉 emoji，移开挡住搜索框的位置。
8. **中文不 fallback 英文**：粤语/普通话只播 C 已翻译好的档位，缺翻译就不再塞英文进去（`personalization.js` 里加了一行过滤）。

---

## 三、已知问题 / 待办

- **照片上传两个 bug（已有人修）**：
  - 以前提交照片不显示「已上传」预览（file input 没接 `onChange`）。
  - 上传后刷新就没了（`posts` 是内存数组 + `blob:` 临时 URL）。
  - **好消息**：主分支上队友已经提交了 `feat: persist memory posts and improve photo uploads`（`1fbd90f`），这两个问题在 main 上应该已经解决。等合并后确认即可。

---

## 四、Git 状态

- 分支：`feat/b-journey`
- 已提交并推送：`979f938`（11 个文件，+661 / −72），新增 `profileService.js`。
- **注意**：main 已经往前走了一大截（队友合了 PR #5、加了照片持久化、neural voices 等），所以 `feat/b-journey` 和 main 有分叉，合并需要解决冲突（主要在 `communityService.js`、`App.jsx` 这些两边都动过的文件）。
- 已打开 PR 页面：`https://github.com/jelly577/living-routes-hk/compare/main...feat/b-journey`（在浏览器里点 Create pull request 即可）。

---

## 五、下一步可选

- [ ] 把 main 的新改动（照片持久化等）合并进 `feat/b-journey` 并解决冲突，再合 PR。
- [ ] 确认照片预览/持久化在合并后正常。
- [ ] （等 C 补内容）把 culture / nature 的专用 hook 补上，替换现在的兜底映射。
