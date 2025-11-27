const chromeLauncher = require("chrome-launcher");
const CDP = require("chrome-remote-interface");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Chrome路径
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// 要拦截的远程资源URL
const remoteUrl =
  "https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js";

// 读取原始响应头
const originalHeaders = JSON.parse(fs.readFileSync(path.resolve(__dirname, "original-headers.json")));

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

async function interceptAndModifyResponse() {
  let chrome;
  let protocol;

  try {
    console.log("正在启动Chrome...");
    chrome = await launchChrome();
    console.log(`Chrome已启动，调试端口: ${chrome.port}`);

    protocol = await CDP({ port: chrome.port });
    console.log("已连接到Chrome调试协议");

    const { Network, Page, Runtime } = protocol;

    // 启用所需域
    await Network.enable();
    await Page.enable();

    // 禁用缓存
    await Network.setCacheDisabled({ cacheDisabled: true });

    // 拦截网络请求
    await Network.setRequestInterception({
      patterns: [
        {
          urlPattern: remoteUrl,
          interceptionStage: "HeadersReceived",
        },
      ],
    });

    // 处理拦截到的请求
    Network.requestIntercepted(async ({ interceptionId, request, responseHeaders }) => {
      console.log(`拦截到请求: ${request.url}`);

      if (request.url === remoteUrl) {
        console.log("匹配目标URL，正在获取原始响应...");

        // 获取原始响应
        const response = await Network.getResponseBodyForInterception({ interceptionId });
        
        let bodyContent;
        if (response.base64Encoded) {
          // 如果是base64编码，先解码
          bodyContent = Buffer.from(response.body, 'base64');
        } else {
          bodyContent = Buffer.from(response.body, 'utf8');
        }

        // 解压缩内容（如果它是gzip压缩的）
        let decompressedContent;
        try {
          decompressedContent = zlib.gunzipSync(bodyContent);
          console.log("内容已解压缩");
        } catch (err) {
          // 如果解压失败，可能是未压缩的内容
          decompressedContent = bodyContent;
          console.log("内容未压缩");
        }

        // 将内容转换为字符串
        const contentString = decompressedContent.toString('utf8');
        console.log(`原始响应大小: ${contentString.length} 字符`);
        
        // 在原始内容末尾添加alert(1)
        const modifiedContent = `${contentString}\nalert(1);`;
        console.log(`修改后大小: ${modifiedContent.length} 字符`);

        // 重新压缩内容（如果原始内容是压缩的）
        let finalContent;
        const isGzipped = originalHeaders["content-encoding"] === "gzip";
        if (isGzipped) {
          finalContent = zlib.gzipSync(Buffer.from(modifiedContent, 'utf8'));
          console.log("内容已重新压缩");
        } else {
          finalContent = Buffer.from(modifiedContent, 'utf8');
        }

        // 构建新的响应，保持所有原始响应头不变
        const httpResponseLines = ["HTTP/1.1 200 OK"];
        for (const [key, value] of Object.entries(originalHeaders)) {
          // 更新Content-Length
          if (key.toLowerCase() === 'content-length') {
            httpResponseLines.push(`${key}: ${finalContent.length}`);
          } else {
            httpResponseLines.push(`${key}: ${value}`);
          }
        }
        
        // 如果没有Content-Length头部，添加一个
        if (!Object.keys(originalHeaders).some(h => h.toLowerCase() === 'content-length')) {
          httpResponseLines.push(`Content-Length: ${finalContent.length}`);
        }

        const httpResponse = [...httpResponseLines, ""].join("\r\n");
        const rawResponseBuffer = Buffer.concat([Buffer.from(httpResponse, 'utf8'), finalContent]);

        await Network.continueInterceptedRequest({
          interceptionId,
          rawResponse: rawResponseBuffer.toString('base64'),
        });

        console.log("已成功修改并在末尾添加alert(1)，保持响应头与原始响应完全一致");
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

interceptAndModifyResponse();