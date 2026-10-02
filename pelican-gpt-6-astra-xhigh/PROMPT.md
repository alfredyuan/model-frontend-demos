请生成一个经典的「鹈鹕骑自行车」3D 网页（这是大模型前端能力测试里常见的题目），尽情发挥，做得越精彩越好。

要求：
- 产物写在当前目录：入口是 index.html，可以再拆出 JS/CSS 文件。
- 使用 Three.js r160。当前目录 ./vendor/ 下已经有本地副本：
  - ./vendor/three.module.js
  - ./vendor/addons/controls/OrbitControls.js（只从 'three' 导入）
  用 importmap 把 "three" 映射到 ./vendor/three.module.js、"three/addons/" 映射到 ./vendor/addons/。不要引用任何 CDN 或外部网络资源。
- 页面会部署到 GitHub Pages，用户主要在安卓手机浏览器上看，要支持触屏操作。
- 不要修改 ./vendor/ 里的文件。
