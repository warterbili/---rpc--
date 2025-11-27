const chromeLauncher = require("chrome-launcher");
const CDP = require("chrome-remote-interface");
const fs = require("fs");
const path = require("path");

// Chrome路径
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// 要拦截的远程资源URL
const remoteUrl =
  "https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js";

async function launchChrome() {
  return await chromeLauncher.launch({
    chromePath: chromePath,
    userDataDir: "D:/自动化rpc方案/userdata",
    chromeFlags: [
      // "--remote-debugging-port=9222",
      // "--no-first-run",
      // "--no-default-browser-check"
    ],
  });
}

async function captureResponse() {
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

    // 捕获响应内容
    Network.responseReceived(async ({ requestId, response }) => {
      if (response.url === remoteUrl) {
        console.log("捕获到目标响应:");
        console.log("URL:", response.url);
        console.log("状态:", response.status);
        console.log("响应头:", response.headers);

        try {
          // 获取响应体
          const responseBody = await Network.getResponseBody({ requestId });
          console.log("是否有响应体:", responseBody.base64Encoded);

          // 保存响应体到文件
          const content = responseBody.base64Encoded
            ? Buffer.from(responseBody.body, "base64")
            : responseBody.body;

          const outputPath = path.resolve(__dirname, "original-response.js");
          fs.writeFileSync(outputPath, content);
          console.log(`原始响应已保存到: ${outputPath}`);

          // 保存响应头信息
          const headersPath = path.resolve(__dirname, "original-headers.json");
          fs.writeFileSync(
            headersPath,
            JSON.stringify(response.headers, null, 2)
          );
          console.log(`响应头已保存到: ${headersPath}`);
        } catch (e) {
          console.error("获取响应体失败:", e);
        }
      }
    });

    console.log("正在导航到目标网站...");
    // 导航到目标网站
    await Page.navigate({ url: "https://shopeefood.vn/" });

    // 等待一段时间以确保资源加载
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log("原始响应信息已捕获");
    console.log("请检查以下文件:");
    console.log("- original-response.js: 原始JS文件内容");
    console.log("- original-headers.json: 原始响应头");

    // 关闭浏览器
    await protocol.close();
    chrome.kill();
    console.log("浏览器已关闭");
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

captureResponse();
