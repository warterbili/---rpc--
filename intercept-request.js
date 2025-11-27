const chromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');
const fs = require('fs');

// Chrome路径
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// 要拦截的远程资源URL
const remoteUrl = 'https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js';

// 本地替换文件路径
const localFilePath = 'D:/自动化rpc方案/vendor-44af7fe3567cabf1519c.js';

async function launchChrome() {
  return await chromeLauncher.launch({
    chromePath: chromePath,
    chromeFlags: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-ipc-flooding-protection',
      '--no-default-browser-check',
      '--no-first-run',
      '--disable-sync',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-component-update',
      '--disable-notifications',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
    ]
  });
}

async function interceptRequest() {
  let chrome;
  let protocol;
  
  try {
    chrome = await launchChrome();
    protocol = await CDP({ port: chrome.port });
    
    const { Network, Page, Runtime, Security } = protocol;
    
    // 启用所需域
    await Network.enable();
    await Page.enable();
    await Runtime.enable();
    await Security.enable();
    
    // 忽略证书错误
    Security.setOverrideCertificateErrors({ override: true });
    Security.certificateError(({ eventId }) => {
      Security.handleCertificateError({ eventId, action: 'continue' });
    });
    
    // 读取本地文件内容
    const localFileContent = fs.readFileSync(localFilePath, 'utf8');
    
    // 拦截网络请求
    await Network.setRequestInterception({ patterns: [{ urlPattern: remoteUrl }] });
    
    // 处理拦截到的请求
    Network.requestIntercepted(async ({ interceptionId, request }) => {
      console.log('拦截到请求:', request.url);
      
      if (request.url === remoteUrl) {
        // 返回本地文件内容
        await Network.continueInterceptedRequest({
          interceptionId,
          rawResponse: Buffer.from(
            'HTTP/1.1 200 OK\r\n' +
            'Content-Type: application/javascript\r\n' +
            'Content-Length: ' + Buffer.byteLength(localFileContent) + '\r\n' +
            '\r\n' +
            localFileContent
          ).toString('base64')
        });
        console.log('已替换为本地文件内容');
      } else {
        // 其他请求正常处理
        await Network.continueInterceptedRequest({ interceptionId });
      }
    });
    
    // 设置用户代理和其他参数来模拟真实浏览器
    await Network.setUserAgentOverride({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
    });
    
    // 导航到目标网站
    await Page.navigate({ url: 'https://shopeefood.vn/' });
    
    // 等待页面加载完成
    await Page.loadEventFired();
    
    // 执行一些浏览器指纹隐藏操作
    await Runtime.evaluate({
      expression: `
        // 隐藏webdriver属性
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // 修改plugins和mimeTypes
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        Object.defineProperty(navigator, 'mimeTypes', {
          get: () => [1, 2, 3, 4, 5]
        });
      `,
      returnByValue: true
    });
    
    // 保持连接打开以便继续监听
    console.log('浏览器已启动，正在加载页面...');
    console.log('访问 https://shopeefood.vn/');
    console.log('按 Ctrl+C 停止脚本并关闭浏览器');
    
    // 监听退出信号以优雅地关闭Chrome
    process.on('SIGINT', async () => {
      console.log('\n正在关闭浏览器...');
      await protocol.close();
      chrome.kill();
      process.exit(0);
    });
    
  } catch (err) {
    console.error('发生错误:', err);
    if (protocol) {
      await protocol.close();
    }
    if (chrome) {
      chrome.kill();
    }
  }
}

interceptRequest();