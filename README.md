# Living Routes HK · 本地前端原型

这是依据团队当前产品结构重新实现的独立 React/Vite MVP，不是 Base44 源码的付费导出副本。

## 当前可演示流程

- 兴趣问卷与身份选择
- 地图主页、目的地搜索、AI 路线摘要
- Official Heritage / Civilian Voices 双轨音频播放器
- 社区筛选、发布模拟内容
- 私人照片/文字记录与 AI 旅行日志生成演示

## 本地运行

在 VS Code 中选择 **File → Open Folder**，打开本项目目录。然后打开内置终端执行：

```bash
npm install
npm run dev
```

终端出现 `Local: http://localhost:5173/` 后，在浏览器打开该地址。按 `Control + C` 可停止服务器。

也可以在 VS Code 中选择 **Terminal → Run Task → Start Living Routes Demo**。

## 尚未连接

- 真实地图与 GPS
- 香港巴士/电车路线 API
- 用户账户和云端数据库
- 真实 GenAI、TTS 和视频生成 API
- 内容审核与来源检索

这些功能应在确认 MVP 演示路线后逐项接入。
