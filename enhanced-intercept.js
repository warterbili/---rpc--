const chromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

// Chrome路径
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// 要拦截的远程资源URL
const remoteUrl = 'https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js';

// 本地替换文件路径
const localFilePath = path.resolve(__dirname, 'vendor-44af7fe3567cabf1519c.js');

// 检查本地文件是否存在
if (!fs.existsSync(localFilePath)) {
  console.error(`本地文件不存在: ${localFilePath}`);
  process.exit(1);
}

console.log(`使用本地文件: ${localFilePath}`);

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
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
      '--window-size=1920,1080'
    ]
  });
}

async function interceptRequest() {
  let chrome;
  let protocol;
  
  try {
    console.log('正在启动Chrome...');
    chrome = await launchChrome();
    console.log(`Chrome已启动，调试端口: ${chrome.port}`);
    
    protocol = await CDP({ port: chrome.port });
    console.log('已连接到Chrome调试协议');
    
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
    console.log(`已读取本地文件，大小: ${localFileContent.length} 字符`);
    
    // 拦截网络请求
    await Network.setRequestInterception({ patterns: [{ urlPattern: remoteUrl }] });
    
    // 处理拦截到的请求
    Network.requestIntercepted(async ({ interceptionId, request }) => {
      console.log(`拦截到请求: ${request.url}`);
      
      if (request.url === remoteUrl) {
        // 返回本地文件内容
        const responseHeaders = [
          'HTTP/1.1 200 OK',
          'Content-Type: application/javascript',
          `Content-Length: ${Buffer.byteLength(localFileContent)}`,
          'Cache-Control: no-cache',
          ''
        ].join('\r\n');
        
        const rawResponse = responseHeaders + localFileContent;
        
        await Network.continueInterceptedRequest({
          interceptionId,
          rawResponse: Buffer.from(rawResponse).toString('base64')
        });
        
        console.log('已成功替换为本地文件内容');
      } else {
        // 其他请求正常处理
        await Network.continueInterceptedRequest({ interceptionId });
      }
    });
    
    // 设置用户代理
    await Network.setUserAgentOverride({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
    });
    
    // 注入隐藏WebDriver的脚本
    await Page.addScriptToEvaluateOnNewDocument({
      source: `
        // 隐藏 webdriver 属性
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // 修改 plugins 和 mimeTypes
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        Object.defineProperty(navigator, 'mimeTypes', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        window.chrome = {
          runtime: {}
        };
        
        Object.defineProperty(navigator, 'permissions', {
          get: () => undefined
        });
      `
    });
    
    console.log('正在导航到目标网站...');
    // 导航到目标网站
    await Page.navigate({ url: 'https://shopeefood.vn/' });
    
    // 等待页面加载完成
    await Page.loadEventFired();
    console.log('页面加载完成');
    
    // 保持连接打开以便继续监听
    console.log('浏览器已启动并加载页面');
    console.log('访问地址: https://shopeefood.vn/');
    console.log('按 Ctrl+C 停止脚本并关闭浏览器');
    
    // 监听退出信号以优雅地关闭Chrome
    process.on('SIGINT', async () => {
      console.log('\n正在关闭浏览器...');
      try {
        await protocol.close();
        chrome.kill();
      } catch (err) {
        console.error('关闭浏览器时出错:', err);
      }
      process.exit(0);
    });
    
  } catch (err) {
    console.error('发生错误:', err);
    if (protocol) {
      try {
        await protocol.close();
      } catch (closeErr) {
        console.error('关闭协议时出错:', closeErr);
      }
    }
    if (chrome) {
      try {
        chrome.kill();
      } catch (killErr) {
        console.error('终止Chrome进程时出错:', killErr);
      }
    }
    process.exit(1);
  }
}

interceptRequest();