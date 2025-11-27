# ShopeeFood JS 拦截器

这个工具使用 `chrome-remote-interface` 库启动带有特定配置的 Chrome 浏览器，拦截对 `https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js` 的请求，并用本地文件 `vendor-44af7fe3567cabf1519c.js` 替换响应内容。

## 功能特点

1. 启动带有反检测配置的 Chrome 浏览器
2. 拦截特定 JS 文件请求
3. 使用本地文件替换远程文件内容
4. 隐藏浏览器自动化特征

## 安装依赖

```bash
npm install
```

## 使用方法

运行以下命令启动脚本：

```bash
node enhanced-intercept.js
```

或者使用 npm 脚本：

```bash
npm start
```

## 百度JS文件拦截测试

还有一个针对百度的测试脚本，用于拦截百度网站的JS文件：

```bash
node baidu-intercept.js
```

此脚本会拦截 `https://pss.bdstatic.com/static/superman/js/lib/esl-cf7161da9a.js` 并用本地 [example.js](file://d:\自动化rpc方案\example.js) 文件替换。

## 工作原理

1. 使用 `chrome-launcher` 启动一个带有特殊标志的 Chrome 实例，这些标志有助于避免被检测为自动化浏览器
2. 通过 `chrome-remote-interface` 连接到 Chrome 实例并与 Chrome DevTools 协议交互
3. 启用网络拦截功能，专门拦截对指定 JS 文件的请求
4. 当拦截到匹配的请求时，使用本地文件内容构造响应并返回给浏览器
5. 注入额外的 JavaScript 代码来隐藏自动化痕迹

## 注意事项

- 确保 Chrome 浏览器安装在默认位置，或在脚本中修改 [chromePath](file:///D:/自动化rpc方案/enhanced-intercept.js#L4-L4) 变量
- 脚本会自动处理 SSL 证书错误
- 按 `Ctrl+C` 可以优雅地关闭浏览器并退出脚本

## 反爬虫对策

该脚本采用多种技术来避免被网站检测为机器人：

1. 禁用各种可能暴露自动化的 Chrome 标志
2. 伪装 User-Agent 为普通浏览器
3. 隐藏 `navigator.webdriver` 属性
4. 模拟真实的浏览器插件和 MIME 类型
5. 禁用证书错误检查以避免某些安全检查问题