const chromeLauncher = require("chrome-launcher");
const CDP = require("chrome-remote-interface");
const fs = require("fs");
const path = require("path");
// 移除zlib引入，因为我们不再需要压缩

// Chrome路径
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// 要拦截的远程资源URL
const remoteUrl =
  "https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js";

// 本地替换文件路径
const localFilePath = "D:/自动化rpc方案/vendor-44af7fe3567cabf1519c.js";

// 检查本地文件是否存在
if (!fs.existsSync(localFilePath)) {
  console.error(`本地文件不存在: ${localFilePath}`);
  process.exit(1);
}

console.log(`使用本地文件: ${localFilePath}`);

async function launchChrome() {
  return await chromeLauncher.launch({
    chromePath: chromePath,
    userDataDir: "D:/自动化rpc方案/userdata", // 根据规范设置为false
    chromeFlags: [
      // "--remote-debugging-port=9222",
      // "--no-first-run",
      // "--no-default-browser-check",
      // "--disable-web-security"
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

    const { Network, Page, Runtime, Security } = protocol;

    // 启用所需域
    await Network.enable();
    await Page.enable();
    await Runtime.enable();
    await Security.enable();

    // 忽略证书错误
    Security.setOverrideCertificateErrors({ override: true });
    Security.certificateError(({ eventId }) => {
      Security.handleCertificateError({ eventId, action: "continue" });
    });

    // 禁用缓存
    await Network.setCacheDisabled({ cacheDisabled: true });

    // 读取本地文件内容（不再进行gzip压缩）
    const localFileContent = fs.readFileSync(localFilePath, "utf8");
    console.log(`已读取本地文件，大小: ${localFileContent.length} 字符`);

    // 拦截网络请求
    await Network.setRequestInterception({
      patterns: [
        {
          urlPattern: remoteUrl,
          interceptionStage: "HeadersReceived", // 在接收到响应头时拦截
        },
      ],
    });

    // 处理拦截到的请求
    Network.requestIntercepted(
      async ({ interceptionId, request, responseHeaders, resourceType }) => {
        console.log(`拦截到请求: ${request.url} (类型: ${resourceType})`);

        if (request.url === remoteUrl) {
          console.log("匹配目标URL，准备替换响应内容...");

          // 使用更简单的方式直接提供响应内容，而不是构造原始HTTP响应
          await Network.continueInterceptedRequest({
            interceptionId,
            responseCode: 200,
            responseHeaders: {
              "Content-Type": "application/javascript; charset=utf-8",
              "Cache-Control": "max-age=604800",
              "Expires": "Thu, 04 Dec 2025 16:15:00 GMT",
              "Last-Modified": "Thu, 27 Nov 2025 09:54:19 GMT",
              "ETag": 'W/"69281fcb-2ca54c"',
              "Server": "SGW",
              "Vary": "Accept-Encoding",
              "x-ratelimit-limit": "125",
              "x-ratelimit-remaining": "124",
              "Date": "Thu, 27 Nov 2025 16:15:00 GMT"
            },
            body: Buffer.from(localFileContent, "utf8").toString("base64")
          });

          console.log("已成功替换为本地文件内容");
        } else {
          // 其他请求正常处理
          await Network.continueInterceptedRequest({ interceptionId });
        }
      }
    );

    // 注入隐藏WebDriver的脚本
    await Page.addScriptToEvaluateOnNewDocument({
      source: `
        // 隐藏 webdriver 属性
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // 删除 navigator 上的 webdriver 属性
        delete navigator.__proto__.webdriver;
        
        // 修改 plugins 和 mimeTypes
        const plugins = {
          length: 3,
          0: { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
          1: { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
          2: { name: "Native Client", filename: "internal-nacl-plugin" }
        };
        Object.setPrototypeOf(plugins, PluginArray.prototype);
        Object.defineProperty(navigator, 'plugins', {
          get: () => plugins
        });
        
        const mimeTypes = {
          length: 3,
          0: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format" },
          1: { type: "text/pdf", suffixes: "pdf", description: "Portable Document Format" },
          2: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" }
        };
        Object.setPrototypeOf(mimeTypes, MimeTypeArray.prototype);
        Object.defineProperty(navigator, 'mimeTypes', {
          get: () => mimeTypes
        });
        
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {}
        };
        
        Object.defineProperty(navigator, 'permissions', {
          get: () => undefined
        });
      `,
    });

    console.log("正在导航到目标网站...");
    // 导航到目标网站
    await Page.navigate({ url: "https://shopeefood.vn/" });

    // 等待页面加载完成
    await Page.loadEventFired();
    console.log("页面加载完成");

    // 等待页面稳定
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 页面加载完成后，注入并执行指定的JavaScript代码
    console.log("正在执行自定义JavaScript代码...");

    // 执行JavaScript代码获取数据并写入文件
    const executionResult = await Runtime.evaluate({
      expression: `
        (function() {
          try {
            // 执行指定的函数调用
            var result = window.screen.bbb("https://gappapi.deliverynow.vn/api/delivery/get_detail?id_type=2&request_id=319486", undefined);
            return JSON.stringify(result);
          } catch (e) {
            return "Error: " + e.message;
          }
        })();
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    // 将结果写入本地txt文件
    const outputPath = path.resolve(__dirname, "result.txt");
    fs.writeFileSync(outputPath, executionResult.result.value, "utf8");
    console.log(`结果已写入文件: ${outputPath}`);

    // 保持连接打开以便继续监听
    console.log("浏览器已启动并加载页面");
    console.log("访问地址: https://shopeefood.vn/");
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
    if (protocol) {
      try {
        await protocol.close();
      } catch (closeErr) {
        console.error("关闭协议时出错:", closeErr);
      }
    }
    if (chrome) {
      try {
        chrome.kill();
      } catch (killErr) {
        console.error("终止Chrome进程时出错:", killErr);
      }
    }
    process.exit(1);
  }
}

interceptRequest();
