# 同学 A｜底层架构验收与交接 Demo

## 一、验收结论标准

A阶段通过必须同时满足：

```text
自动测试通过
    +
浏览器骨架流程通过
    +
B、C在另一台电脑成功运行并调用接口
```

前两项可以由A自己完成；第三项必须在正式交接时由B、C现场操作。

## 二、验收方式一：终端自动检查

在 VS Code 打开项目文件夹，进入终端执行：

```bash
npm install
npm run test:services
npm run build
```

通过标准：

- 五项服务测试全部显示 `✓`。
- 构建最后显示 `✓ built`。
- 没有红色报错。

再执行：

```bash
npm run demo:handover
```

应该看到：

- 城巴1号线正确方向。
- 五个文化节点按顺序列出。
- 剩余10秒选择 `short`。
- 剩余40秒选择 `medium`。
- 剩余80秒选择 `long`。

## 三、验收方式二：浏览器骨架流程

执行：

```bash
npm run dev
```

打开终端显示的本地网址，然后检查：

1. 完成兴趣问卷，进入地图页面。
2. 点击 `Route`。
3. 路线卡片显示：
   - `Citybus 1`
   - `Central (Macao Ferry) → Happy Valley (Upper)`
   - `5 Heritage points`
   - `2 Story tracks`
4. 点击 `Begin Route`。
5. 播放器显示 `Central Market`。
6. 切换 `Official Heritage / Civilian Voices`，标题和来源标签跟着改变。
7. 进入 Community，确认示例帖子可以读取和筛选。
8. 新增一条帖子，确认可以选择是否允许AI整理。
9. 进入 Private Journal，添加文字后生成旅行日志。

当前界面仍是假地图，故事正文仍是 placeholder，这是正常的，不属于A阶段失败。

## 四、正式交接时要展示的三个 Demo

### Demo 1：数据和接口底座

操作：

```bash
npm run demo:handover
```

向队友说明：

- 路线、地点和接口已经统一。
- B不需要自己重新创建地点列表。
- C不需要自己设计新的故事字段。
- 剩余车程是故事长度的主要输入。

### Demo 2：页面已经使用接口

操作路线：

```text
兴趣问卷
→ Route
→ 显示城巴1号线和5个文化节点数量
→ Begin Route
→ Official/Civilian切换
→ Community
→ Private Journal
```

目的不是证明地图和AI已经完成，而是证明：后续替换真实地图、正式文案或LLM时，不需要推翻现有页面流程。

### Demo 3：B、C各自现场调用一次

B执行或在代码中调用：

```js
const route = await getRoute({ mode: 'demo' });
console.log(route.path, route.storyPoints);
```

验收：能得到路线坐标和按顺序排列的五个地点。

C执行或在代码中调用：

```js
const result = await getStories({
  placeId: 'blue-house',
  track: 'civilian',
  length: 'medium',
});
console.log(result.story);
```

验收：能得到固定故事结构，并清楚在哪里替换 placeholder。

## 五、交接会议建议流程（约30分钟）

| 时间 | 内容 |
|---|---|
| 0–5分钟 | 说明固定路线、五个地点和项目流程 |
| 5–10分钟 | 执行自动测试和 `demo:handover` |
| 10–15分钟 | 演示浏览器骨架流程 |
| 15–22分钟 | B现场运行并读取 `getRoute()` |
| 22–27分钟 | C现场运行并读取 `getStories()` |
| 27–30分钟 | 确认分支、截止时间、已知限制和下一次合并时间 |

## 六、A阶段不应宣称已经完成的内容

- 真实地图、路线折线和移动蓝点。
- GPS地点触发和利东街／蓝屋防重复机制。
- 18篇正式讲稿。
- 真正的TTS、LLM或RAG。
- 实时公交数据。
- 数据库、账户和云端存储。

正确说法是：

> 数据结构、服务接口和Mock闭环已经完成；真实地图由B接入，正式内容和AI能力由C接入。

## 七、正式交接通过条件

- [ ] A的自动测试与构建通过。
- [ ] 浏览器骨架流程无阻断错误。
- [ ] B、C成功克隆或拉取同一版本。
- [ ] B成功读取路线和五个地点。
- [ ] C成功读取并理解故事结构。
- [ ] 三人确认接口字段和分支边界。
- [ ] 三人约定第一次合并时间。

