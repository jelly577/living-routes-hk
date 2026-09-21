# Living Routes HK — A 阶段底座交接

## 当前负责人

- 阶段：Stage 1 — 数据与接口底座
- 负责人：同学 A
- 下一位负责人：同学 B、同学 C
- 第一版完成日期：2026-09-21

## 当前状态

- [x] React + Vite 本地项目可运行
- [x] 兴趣问卷
- [x] 地图、社区、私人日志页面骨架
- [x] 路线与播放器模拟交互
- [x] 社区发布与旅行日志模拟交互
- [x] `npm run build` 可通过
- [x] 建立远程 GitHub 仓库
- [x] 确定城巴1号线与5个文化节点
- [x] 建立 `src/data/` 与固定路线数据
- [x] 建立 `src/services/` 与6个异步 Mock 接口
- [x] 页面开始通过服务接口读取路线、故事、社区和日志数据
- [x] 增加接口自测和接口合同
- [ ] B、C 均在自己的电脑成功运行并调用接口
- [ ] 五个地点坐标与路线几何由 B 最终核对
- [ ] 18篇正式内容由 C 替换 placeholder
- [ ] 五个地点的准确图片、来源和授权信息由 C／内容负责人提供

## 启动方法

```bash
npm install
npm run test:services
npm run demo:handover
npm run build
npm run dev
```

接口说明：[`docs/API-CONTRACT.md`](docs/API-CONTRACT.md)

验收流程：[`docs/A-STAGE-ACCEPTANCE.md`](docs/A-STAGE-ACCEPTANCE.md)

## 当前限制

- 地图仍为视觉模拟，等待 B 接入真实地图。
- 路线移动、GPS、音频和 GenAI 目前均为模拟或 Mock。
- 社区与私人记录只保存在当前页面状态，刷新后会消失。
- 图片和字体来自互联网，离线时可能无法显示。
- `places.js` 中坐标标记为 Demo 坐标，仍需地图核对。
- 故事正文是明确标注的 placeholder，不能用于正式路演内容。

## 下一步

1. B 拉取代码并完成底图、Marker、Polyline 独立实验。
2. C 按现有字段替换故事 placeholder，保留来源和审核状态。
3. C 按 `docs/TASK-C-VERIFIED-PLACE-IMAGES.md` 提交五个地点的核实图片包。
4. B、C 分别确认可以调用 `getRoute()` 与 `getStories()`。
5. A 收集反馈；必要修改必须保持接口向后兼容。
6. 10月1–2日由 A 分批合并 B、C 分支。

## 本次改动文件

```text
src/data/*
src/services/*
docs/API-CONTRACT.md
scripts/service-smoke-test.mjs
src/App.jsx
README.md
HANDOVER.md
package.json
```
