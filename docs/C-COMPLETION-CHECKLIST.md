# C 同学交付清单

最后更新：2026-09-28

## 已完成（代码或素材已在仓库）

- [x] 18 段故事结构：5 个地点、Official/Civilian、short/medium/long 组合。
- [x] 18/18 提供 English、普通话、粤语版本。
- [x] 18/18 有来源 URL。
- [x] Civilian 内容均有 disclosure，未把公开资料改编冒充真实居民投稿。
- [x] 5 个地点主图与 gallery，状态为 `verified`，并记录授权/署名信息。
- [x] 51 个启用的备用音频；终审法院 Official 三语因文字修订暂时使用浏览器 TTS，避免播放旧稿。旧文件保留但已从 manifest 移除。
- [x] 播放器的音频、暂停、进度和三语切换。
- [x] 无网络/无音频时的浏览器语音或文字兜底。
- [x] 按兴趣和剩余时间选择故事的规则逻辑。
- [x] 语音投稿的本地 Demo：音频预览、转写占位、结构化提取、三语草稿、人工审核路由。
- [x] 私人旅行日志 Mock，以及从照片/文字提取兴趣信号并生成下一段推荐。
- [x] 竞品、Why Now、商业模式和 Michael 四题 Q&A 初稿。

## 今天还需要人工完成

- [ ] 逐条打开来源，核对 18 段英文事实和数字。
- [ ] 至少由一位队友通读普通话和粤语，修正专名、口语和语气。
- [ ] 把确认过的故事 `reviewStatus` 从 `draft-needs-human-review` 改为 `human-reviewed`；不要在没有核对时批量修改。
- [ ] 为 Local Voices 收集至少一段 20–40 秒、明确授权的粤语原声；没有录音的内容继续保留 `Demo adaptation`。
- [ ] 最终决定是否把 Culture Bites 放进首场演示；如果时间不够，可以只展示其内容模型，不把它变成第四个大页面。
- [ ] 最终演示前核对图片署名是否在页面可见，尤其是 CC BY / CC BY-SA 图片。

## 自动检查

```bash
npm run audit:content
npm run test:services
npm run build
```

`audit:content` 的 `Human review status: 0/18` 是有意保留的安全提示，不是程序错误。

在普通 macOS Terminal 重新运行 `node scripts/generate-audio.mjs --force` 后，可重建终审法院三语音频并恢复为 54 个启用条目。受限执行环境中的 `say` 可能无法输出音频，因此生成脚本会在检测到空文件时停止，避免覆盖现有素材。
