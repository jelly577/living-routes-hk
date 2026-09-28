# Living Routes HK｜A 阶段接口合同

> 状态：v1 Mock 接口已可调用。B、C 可以基于本文件并行开发；修改函数签名前必须三人同步。

## 统一入口

```js
import {
  getRoute,
  getStories,
  getStoryForJourney,
  getPosts,
  getMyPosts,
  addPost,
  deletePost,
  generateJourneyLog,
} from './services/index.js';
```

## B：地图与旅程

### 获取路线

```js
const route = await getRoute({
  origin: 'Central (Macao Ferry)',
  destination: 'Happy Valley (Upper)',
  mode: 'demo',
});
```

主要返回字段：

```text
id, routeNumber, origin, destination, estimatedDurationMin,
path, stops, storyPoints
```

`storyPoints` 已按路线顺序排列。坐标目前适合 Demo，正式展示前需由 B 实地或地图核对。

每个地点的 `image` 包含 `url`、`alt`、`sourceUrl`、`license` 和 `status`。C提供核实后的图片资料，B只显示 `status: 'verified'` 的地点图；未核实内容继续显示占位状态。

### 根据剩余时间获取故事

```js
const result = await getStoryForJourney({
  placeId: 'central-market',
  track: 'official',
  remainingTimeSec: 45,
  interests: ['Architecture'],
  audience: 'visitor',
});
```

`audience` 可选值为 `visitor`、`local-resident`，供 C 调整背景解释程度和叙事视角。MVP 不加入同行对象或游客熟悉程度等额外维度。

时长选择规则：

```text
≤20秒 → short
21–55秒 → medium
>55秒 → long
```

## C：内容、TTS与GenAI

### 获取指定故事

```js
const result = await getStories({
  placeId: 'blue-house',
  track: 'civilian',
  length: 'medium',
});
```

故事数据位置：`src/data/places.js`。当前正文是明确标注的 placeholder，C 可替换正文、标题、时长、来源和审核状态，但不要改变字段层级。

### 生成私人旅行日志

```js
const log = await generateJourneyLog({
  route,
  memories,
  style: 'reflective',
  language: 'en',
});
```

当前返回审核过的 Mock 结果；C 可以在 `journeyLogService.js` 内部替换为 LLM 调用，接口签名保持不变。

## 社区

```js
const posts = await getPosts({ filter: 'local', bounds });

const post = await addPost({
  photo,
  text,
  location: 'lee-tung-street',
  role: 'local',
  visibility: 'private', // private | community
  photoStyle: 'pencil', // original | cartoon | pencil | none
  consent: true,
});
```

`consent: true` 只表示允许内容进入后续审核流程，不代表可以自动作为事实发布或训练数据。

`getMyPosts()` 返回当前浏览器内保存的全部个人内容；`getPosts()` 只把 `visibility: 'community'` 的个人内容加入社区列表；`deletePost(id)` 永久删除当前设备上的一条个人记录。浏览器版本使用 IndexedDB，因此刷新页面后仍会保留；它不是跨设备共享的云端后端。Cartoon 和 Pencil 会在浏览器本地转换并保存，原型不会把照片发送给第三方图片服务。

## 五个地点 ID

```text
central-market
court-of-final-appeal
lee-tung-street
blue-house
happy-valley-racecourse
```

## 自测

```bash
npm run test:services
npm run build
```
