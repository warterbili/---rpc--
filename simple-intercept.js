const chromeLauncher = require("chrome-launcher");
const CDP = require("chrome-remote-interface");
const fs = require("fs");
const path = require("path");

// Chrome路径
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// 要拦截的远程资源URL
const remoteUrl =
  "https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js";

// 本地替换文件路径
const localFilePath = path.resolve(__dirname, "vendor-44af7fe3567cabf1519c.js");

// 检查本地文件是否存在
if (!fs.existsSync(localFilePath)) {
  console.error(`本地文件不存在: ${localFilePath}`);
  process.exit(1);
}

async function launchChrome() {
  return await chromeLauncher.launch({
    chromePath: chromePath,
    userDataDir: false,
    chromeFlags: [
      "--remote-debugging-port=9222",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-web-security"
    ],
  });
}

async function interceptRequest() {
  let chrome;
  let protocol;

  try {
    console.log("正在启动Chrome...");
    chrome = await launchChrome();
    console.log(`Chrome已启动，调试端口: ${chrome.port}`);

    protocol = await CDP({ port: chrome.port });
    console.log("已连接到Chrome调试协议");

    const { Network, Page } = protocol;

    // 启用所需域
    await Network.enable();
    await Page.enable();

    // 禁用缓存
    await Network.setCacheDisabled({ cacheDisabled: true });

    // 读取本地文件内容
    const localFileContent = fs.readFileSync(localFilePath, 'utf8');
    console.log(`已读取本地文件，大小: ${localFileContent.length} 字符`);

    // 拦截网络请求
    await Network.setRequestInterception({
      patterns: [{ urlPattern: remoteUrl }],
    });

    // 处理拦截到的请求
    Network.requestIntercepted(async ({ interceptionId, request }) => {
      console.log(`拦截到请求: ${request.url}`);

      if (request.url === remoteUrl) {
        console.log("匹配目标URL，替换为本地文件内容");

        // 构造响应
        const responseHeaders = [
          "HTTP/1.1 200 OK",
          "Content-Type: application/javascript; charset=utf-8",
          `Content-Length: ${Buffer.byteLength(localFileContent, 'utf8')}`,
          "Cache-Control: no-cache, no-store, must-revalidate",
          "Pragma: no-cache",
          "Expires: 0",
          ""
        ].join("\r\n");

        const rawResponse = responseHeaders + localFileContent;
        
        await Network.continueInterceptedRequest({
          interceptionId,
          rawResponse: Buffer.from(rawResponse, 'utf8').toString('base64')
        });

        console.log("替换完成");
      } else {
        // 其他请求正常处理
        await Network.continueInterceptedRequest({ interceptionId });
      }
    });

    console.log("正在导航到目标网站...");
    await Page.navigate({ url: "https://shopeefood.vn/" });
    await Page.loadEventFired();
    console.log("页面加载完成");

    console.log("按 Ctrl+C 停止脚本并关闭浏览器");
    
    // 监听退出信号以优雅地关闭Chrome
    process.on("SIGINT", async () => {
      console.log("\n正在关闭浏览器...");
      try {
        await protocol.close();
        chrome.kill();
      } catch (err) {
        console.error("关闭浏览器时出错:", err);
      }
      process.exit(0);
    });
    
  } catch (err) {
    console.error("发生错误:", err);
    process.exit(1);
  }
}

interceptRequest();