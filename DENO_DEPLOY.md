# 免费部署：Deno Deploy

如果 Render 提示需要付费或绑卡，可以使用 Deno Deploy。

## 部署步骤

1. 打开 https://dash.deno.com
2. 使用 GitHub 登录。
3. 点击 `New Project`。
4. 选择 GitHub 仓库：
   `Janeyes99/SS4.0_Web_Public`
5. 选择分支：`main`
6. Entry point 填：
   `main.js`
7. 点击部署。

部署完成后会得到一个公网域名，例如：
`https://ss4-web-public-sync.deno.dev`

## 访问地址

控制页面：
`https://你的项目名.deno.dev/`

中屏显示：
`https://你的项目名.deno.dev/?screen=center`

左屏显示：
`https://你的项目名.deno.dev/?screen=left`

右屏显示：
`https://你的项目名.deno.dev/?screen=right`

## 每台 Mac 仍需要

1. 把视频放在：
   `/Users/你的用户名/Desktop/SS4.0_Web/video`

2. 双击运行：
   `Mac客户端-启动本地视频服务.command`

3. 不要关闭弹出的终端窗口。

注意：不要再使用公司内网地址 `http://10.133.72.116:3366`，所有电脑必须打开同一个 Deno 公网地址，才能互相关联。
