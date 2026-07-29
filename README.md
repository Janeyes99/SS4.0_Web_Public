# SS4.0 Web GitHub 公网部署包

这个包用于把 SS4.0 Web 放到 GitHub Pages 上，让不同网络下的多台电脑打开同一个公网网址后仍然可以联动。

重要说明：
- 只上传本包到 GitHub，不要上传视频素材。
- 视频仍然放在每台 Mac 本地：`/Users/用户名/Desktop/SS4.0_Web/video`
- 每台 Mac 需要运行 `Mac客户端-启动本地视频服务.command`
- 当前 GitHub Pages 版已内置公网同步脚本，不再依赖公司内网。
- Deno Console 目前对新账号可能会显示 `403 SIGNUP_UNAVAILABLE`，所以本包优先使用 GitHub Pages。

## 推荐部署：GitHub Pages

仓库：
`https://github.com/Janeyes99/SS4.0_Web_Public`

GitHub Pages 设置：
1. 打开仓库的 `Settings`。
2. 打开左侧 `Pages`。
3. `Build and deployment` 选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/dist`
4. 保存后等待 1-3 分钟。

部署完成后的公网地址：
`https://janeyes99.github.io/SS4.0_Web_Public/`

## 打开方式

控制页面：
`https://janeyes99.github.io/SS4.0_Web_Public/`

中屏显示：
`https://janeyes99.github.io/SS4.0_Web_Public/?screen=center`

左屏显示：
`https://janeyes99.github.io/SS4.0_Web_Public/?screen=left`

右屏显示：
`https://janeyes99.github.io/SS4.0_Web_Public/?screen=right`

建议先打开控制页面，再打开左/中/右三个显示页面。控制页面保持打开，不要关闭。

## 多组实验同时运行

如果同一时间有多组设备要跑不同实验，可以给网址加同一个 `room` 参数：

控制页面：
`https://janeyes99.github.io/SS4.0_Web_Public/?room=test01`

中屏：
`https://janeyes99.github.io/SS4.0_Web_Public/?screen=center&room=test01`

左屏：
`https://janeyes99.github.io/SS4.0_Web_Public/?screen=left&room=test01`

右屏：
`https://janeyes99.github.io/SS4.0_Web_Public/?screen=right&room=test01`

同一组设备的 `room` 必须完全一致。

## 每台 Mac 需要做什么

1. 将视频放到：
   `/Users/你的用户名/Desktop/SS4.0_Web/video`

2. 双击运行：
   `Mac客户端-启动本地视频服务.command`

3. 不要关闭弹出的终端窗口。

4. 打开对应的 GitHub Pages 公网页面。

## 常见问题

如果页面能打开但视频不显示：
- 确认本机视频服务窗口没有关闭。
- 确认视频文件在 `/Users/你的用户名/Desktop/SS4.0_Web/video`。
- 确认视频文件名包含“左”“中”“右”对应素材。

如果多个电脑不同步：
- 确认所有电脑打开的是同一个 GitHub Pages 地址。
- 如果用了 `room` 参数，确认所有电脑的 `room` 完全一致。
- 建议先打开控制页面，再打开左屏、中屏、右屏。
- 不要混用公司内网地址 `10.133.72.116:3366` 和 GitHub Pages 公网地址。

## 备用方案

如果未来 Deno 账号可用，也可以用 `DENO_DEPLOY.md` 中的方式部署 `main.js`。Deno / Render 版本仍保留了 `/api/state` 后台同步服务。
