const chromeLauncher = require("chrome-launcher");
const CDP = require("chrome-remote-interface");
const fs = require("fs");
const path = require("path");

// Chrome路径
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// 要拦截的远程资源URL
const remoteUrl = "https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js";

async function launchChrome() {
  return await chromeLauncher.launch({
    chromePath: chromePath,
    userDataDir: "D:/自动化rpc方案/userdata",
    chromeFlags: [
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

    // 更改拦截策略，使用Response阶段拦截以获得更准确的控制
    await Network.setRequestInterception({
      patterns: [
        {
          urlPattern: remoteUrl,
          resourceType: "Script",
          interceptionStage: "HeadersReceived"  // 在接收到响应头时拦截
        }
      ],
    });

    // 处理拦截到的请求 - 在响应阶段进行拦截和替换
    Network.requestIntercepted(async ({ interceptionId, request, responseHeaders, resourceType }) => {
      console.log(`拦截到请求: ${request.url} (类型: ${resourceType})`);

      if (request.url === remoteUrl) {
        console.log("匹配目标URL，准备替换响应内容...");
        
        // 读取本地文件内容
        const filename = path.basename(request.url);
        const localFilepath = `./${filename}`;
        
        if (fs.existsSync(localFilepath)) {
          console.log(`  -> 找到本地替换文件: ${localFilepath}`);
          try {
            // 读取本地文件内容（使用二进制模式以避免编码问题）
            const fileContent = fs.readFileSync(localFilepath, "utf8");
            
            // 构造完整的HTTP响应
            const httpResponse = [
              "HTTP/1.1 200 OK",
              "Content-Type: application/javascript; charset=utf-8",
              `Content-Length: ${Buffer.byteLength(fileContent, "utf8")}`,
              "Connection: close",
              "Server: nginx",
              "Date: " + new Date().toUTCString(),
              "Cache-Control: public, max-age=31536000",
              "Accept-Ranges: bytes",
              "",
              ""
            ].join("\r\n");
            
            const rawResponse = httpResponse + fileContent;
            
            await Network.continueInterceptedRequest({
              interceptionId,
              rawResponse: Buffer.from(rawResponse, "utf8").toString("base64")
            }).catch(err => {
              console.log(`  -> 替换响应失败: ${err.message}`);
            });
            
            console.log("  -> 已成功替换为本地文件内容");
            return;
          } catch (e) {
            console.log(`  -> 读取本地文件失败: ${e}`);
          }
        }
      }
      
      // 其他请求正常处理
      console.log("  -> 继续网络请求");
      await Network.continueInterceptedRequest({ interceptionId }).catch(err => {
        console.log(`  -> 继续请求失败: ${err.message}`);
      });
    });

    console.log("正在导航到目标网站...");
    // 导航到目标网站
    await Page.navigate({ url: "https://shopeefood.vn/" });

    // 等待页面加载完成
    await Page.loadEventFired();
    console.log("页面加载完成");

    // 保持浏览器打开一段时间以供测试
    await new Promise((resolve) => setTimeout(resolve, 60000));

    console.log("测试完成");
  } catch (err) {
    console.error("发生错误:", err);
  } finally {
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
  }
}

interceptRequest();
