# Living Routes HK · 城市声线

这是 React/Vite 实现的 mobile-first MVP。当前固定示范路线为：

> **城巴 1 号线：中环（港澳码头）→ 跑马地（上）**

## 当前可演示流程

- 兴趣问卷与身份选择
- 地图主页、目的地搜索、固定路线与五个文化节点数据
- Official Heritage / Civilian Voices 双轨音频播放器
- 社区筛选、发布模拟内容
- 私人照片/文字记录与 AI 旅行日志生成演示
- 统一的异步 Mock 服务接口

## 本地运行

在 VS Code 中选择 **File → Open Folder**，打开本项目目录。然后打开内置终端执行：

```bash
npm install
cp .env.example .env.local   # 首次需要：填入 Google Maps / Supabase 的公开 key（已在 .env.example 里）
npm run dev
```

终端出现 `Local: http://localhost:5173/` 后，在浏览器打开该地址。按 `Control + C` 可停止服务器。

> `.env.local` 已被 `.gitignore` 忽略；`.env.example` 里的三个值都是公开前端值，可直接复制使用。

也可以在 VS Code 中选择 **Terminal → Run Task → Start Living Routes Demo**。

## 工程自测

```bash
npm run test:services
npm run demo:handover
npm run build
```

## 项目结构

```text
src/data/       固定路线、五个地点、Mock帖子与日志
src/services/   B、C共同调用的稳定接口
docs/           接口合同与交接资料
src/App.jsx     当前页面骨架
```

B、C 开始开发前请先阅读 [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md)。A进行阶段验收时请使用 [`docs/A-STAGE-ACCEPTANCE.md`](docs/A-STAGE-ACCEPTANCE.md)。

## 尚未连接

- 真实地图与 GPS
- 真实路线几何与实时交通 API
- 用户账户和云端数据库
- 真实 GenAI、TTS 和视频生成 API
- 内容审核与来源检索

外部服务不可成为比赛演示的唯一运行路径；每项功能都要保留本地 Mock 或预生成结果。
