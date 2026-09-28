# 上传 GitHub 和分享 Demo

## 当前状态

- 本地分支：`feat/c-ai`
- 远程仓库：`https://github.com/jelly577/living-routes-hk`
- 预计 GitHub Pages 地址：`https://jelly577.github.io/living-routes-hk/`
- 当前 `gh` 登录已失效，需要重新登录。

## 第一次上传 C 分支

在项目目录运行：

```bash
gh auth login -h github.com -w
git status
git add .
git commit -m "feat: complete C content voice and personalization demo"
git push -u origin feat/c-ai
```

然后打开仓库：

```text
https://github.com/jelly577/living-routes-hk
```

GitHub 通常会显示 `Compare & pull request`。建立从 `feat/c-ai` 到 `main` 的 Pull Request，让 A 同学检查后合并。

## 发布 GitHub Pages

仓库已经加入 `.github/workflows/deploy.yml`。合并到 `main` 后：

1. 打开 GitHub 仓库的 `Settings`。
2. 进入 `Pages`。
3. `Build and deployment` 的 Source 选择 `GitHub Actions`。
4. 打开仓库的 `Actions` 页面，等待 `Deploy Living Routes HK to GitHub Pages` 变绿。
5. 访问 `https://jelly577.github.io/living-routes-hk/`。

以后每次向 `main` 推送，Pages 都会自动重新构建。

## 不合并 main 的临时分享方法

如果团队暂时不想合并，可以在 `feat/c-ai` 分支完成 PR，然后让 A 同学本地拉取运行：

```bash
git fetch origin
git switch feat/c-ai
npm install
npm run dev
```

GitHub Pages 自动流程默认只发布 `main`，避免功能分支覆盖团队正式 Demo。

## 图片在哪里

- 图片 URL、来源、作者和许可证：`src/content/placeImages.js`
- 便于团队阅读的图片清单：`docs/C-PLACE-IMAGES.md`
- 页面地图现在会直接显示五个地点的 Wikimedia Commons 图片。
- 图片本身没有复制进仓库；页面联网时从 Wikimedia Commons 加载。

如果比赛现场需要完全离线运行，下一步应把允许使用的图片下载到 `public/images/`，并继续保留署名和许可证信息。

