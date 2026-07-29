# SS4.0 Web GitHub 公网部署包

这个包用于把 SS4.0 Web 部署到公网，让不同网络下的多台电脑打开同一个公网网址后仍然可以实时同步。

重要说明：
- 只上传本包到 GitHub，不要上传视频素材。
- 视频仍然放在每台 Mac 本地：`/Users/用户名/Desktop/SS4.0_Web/video`
- 每台 Mac 需要运行 `Mac客户端-启动本地视频服务.command`
- GitHub Pages 不能单独完成实时同步，因为它没有后台 `/api/state` 服务。
- 推荐用 Render 部署本仓库。Render 会运行 `server.js`，提供网页和同步接口。

## 部署到 GitHub + Render

1. 打开 GitHub，新建一个仓库，例如：`SS4.0_Web_Public`
2. 把本包内所有文件上传到这个仓库根目录。
3. 打开 Render：https://render.com
4. 使用 GitHub 登录 Render。
5. 选择 `New +` -> `Web Service`。
6. 选择刚才的 GitHub 仓库。
7. Render 会自动识别 `render.yaml`，直接创建服务即可。
8. 等部署完成后，Render 会给你一个公网网址，例如：
   `https://ss4-web-public-sync.onrender.com`

## 公网访问地址

假设 Render 给你的公网地址是：
`https://你的服务名.onrender.com`

控制页面：
`https://你的服务名.onrender.com/`

中屏显示：
`https://你的服务名.onrender.com/?screen=center`

左屏显示：
`https://你的服务名.onrender.com/?screen=left`

右屏显示：
`https://你的服务名.onrender.com/?screen=right`

## 每台 Mac 需要做什么

1. 将视频放到：
   `/Users/你的用户名/Desktop/SS4.0_Web/video`

2. 双击运行：
   `Mac客户端-启动本地视频服务.command`

3. 不要关闭弹出的终端窗口。

4. 打开对应的公网页面。

## 常见问题

如果页面能打开但视频不显示：
- 确认本机视频服务窗口没有关闭。
- 确认视频文件在 `/Users/你的用户名/Desktop/SS4.0_Web/video`。
- 确认视频文件名包含“左”“中”“右”对应素材。

如果多个电脑不同步：
- 确认所有电脑打开的是同一个 Render 公网网址。
- 不要混用公司内网地址 `10.133.72.116:3366` 和 Render 公网地址。
- 控制页面使用根路径 `/`，左/中/右显示页面使用 `?screen=...`。
