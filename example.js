const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function connectToCurrentPage() {
  let client;
  
  try {
    console.log('正在连接到Chrome调试端口...');
    // 连接到Chrome实例
    client = await CDP({
      host: 'localhost',
      port: 9222 // Chrome调试端口
    });
    
    console.log('成功连接到Chrome调试端口');
    
    // 获取所有目标页面
    console.log('正在获取目标页面列表...');
    const targets = await client.Target.getTargets();
    console.log('找到的目标页面数量:', targets.targetInfos.length);
    
    // 查找第一个页面目标（非后台目标）
    const pageTarget = targets.targetInfos.find(target => 
      target.type === 'page' && target.url.startsWith('http')
    );
    
    if (!pageTarget) {
      console.log('未找到有效的页面目标');
      return;
    }
    
    console.log('选择页面目标:', pageTarget.url);
    
    // 断开默认客户端连接
    console.log('正在断开默认客户端连接...');
    await client.close();
    
    // 连接到特定页面目标
    console.log('正在连接到特定页面目标...');
    client = await CDP({
      host: 'localhost',
      port: 9222,
      target: pageTarget.targetId
    });
    
    console.log('成功连接到页面目标');
    
    // 提取Domains
    console.log('正在启用Domains...');
    const { Runtime, DOM, Page, Network } = client;
    
    // 启用需要的Domains
    await Page.enable();
    await DOM.enable();
    await Runtime.enable();
    await Network.enable(); // 启用网络域以监听网络请求
    
    console.log('Domains启用完成');
    
    // 监听页面加载事件
    console.log('正在等待页面加载完成...');
    Page.loadEventFired(() => {
      console.log('页面加载完成事件触发');
    });
    
    // 等待一段时间确保页面完全加载
    console.log('等待页面稳定...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 检查页面是否已完全加载
    console.log('检查DOM是否就绪...');
    try {
      const document = await DOM.getDocument();
      console.log('DOM文档已就绪');
    } catch (err) {
      console.log('DOM文档未就绪:', err.message);
    }
    
    // 在当前页面直接注入JavaScript代码
    console.log('正在当前页面注入JavaScript代码...');
    
    // 首先检查元素是否存在
    const elementCheck = await Runtime.evaluate({
      expression: `
        (function() {
          const countrySelect = document.querySelector('#COUNTRY');
          const findButton = document.querySelector('#find_btn');
          return {
            hasCountrySelect: !!countrySelect,
            hasFindButton: !!findButton,
            selectOptions: countrySelect ? countrySelect.options.length : 0
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    
    console.log('页面元素检查结果:', elementCheck.result.value);
    
    if (!elementCheck.result.value.hasCountrySelect || !elementCheck.result.value.hasFindButton) {
      console.log('页面缺少必要的元素，无法继续执行');
      // 尝试获取当前页面的HTML内容进行调试
      const htmlContent = await Runtime.evaluate({
        expression: `
          document.documentElement.outerHTML.substring(0, 500)
        `,
        awaitPromise: true,
        returnByValue: true
      });
      
      console.log('页面内容预览:', htmlContent.result.value);
      return;
    }
    
    // 选择国家并点击搜索按钮
    console.log('正在操作页面元素...');
    const operationResult = await Runtime.evaluate({
      expression: `
        (function() {
          try {
            // 通过索引选择（选择第3个选项，索引为2）
            const countrySelect = document.querySelector('#COUNTRY');
            if (countrySelect.options.length > 2) {
              countrySelect.selectedIndex = 2;
              
              // 手动触发change事件（非常重要）
              const changeEvent = new Event('change', { bubbles: true });
              countrySelect.dispatchEvent(changeEvent);
              
              // 点击搜索按钮
              const findButton = document.querySelector('#find_btn');
              if (findButton) {
                findButton.click();
                return { success: true, message: '操作完成' };
              } else {
                return { success: false, message: '未找到搜索按钮' };
              }
            } else {
              return { success: false, message: '选项数量不足' };
            }
          } catch (error) {
            return { success: false, message: error.message };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    
    console.log('操作结果:', operationResult.result.value);
    
    if (!operationResult.result.value.success) {
      console.log('页面操作失败:', operationResult.result.value.message);
      return;
    }
    
    // 等待网络空闲，类似Puppeteer的networkidle0选项
    console.log('等待网络空闲...');
    await waitForNetworkIdle(Network, 5000, 10000); // 等待5秒内无新请求，最多等待10秒
    
    // 提取表格数据
    console.log('正在提取表格数据...');
    const result = await Runtime.evaluate({
      expression: `
        (function() {
          try {
            // 等待表格出现
            const table = document.querySelector("#gview_searchlist");
            if (!table) {
              return {
                error: "未找到表格元素",
                pageContent: document.body ? document.body.innerText.substring(0, 200) : 'No body content'
              };
            }
            
            const rows = table.querySelectorAll("tr");
            const tableData = [];
            
            rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll("td, th");
                const rowData = [];
                cells.forEach((cell, cellIndex) => {
                    // 检查单元格中是否有图片
                    const img = cell.querySelector('img');
                    if (img && img.src) {
                        // 如果有图片，保存图片URL
                        rowData.push(img.src);
                    } else {
                        // 否则保存文本内容
                        rowData.push(cell.innerText.trim());
                    }
                });
                tableData.push(rowData);
            });
            
            return {
              tableData: tableData,
              rowCount: tableData.length
            };
          } catch (error) {
            return {
              error: error.message
            };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    
    console.log('执行结果:', result.result.value);
    
    // 将获取到的数据写入CSV文件
    if (result.result.value.tableData) {
      console.log('正在处理数据并写入CSV文件...');
      
      // 创建图片保存目录
      const imagesDir = 'images';
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      // 处理图片并写入CSV
      await processAndWriteDataToCSV(result.result.value.tableData, 'exported_data.csv', imagesDir);
    }
    
  } catch (err) {
    console.error('CDP操作出错:', err);
  } finally {
    if (client) {
      await client.close();
      console.log('CDP客户端已关闭');
    }
  }
}

// 等待网络空闲的函数，类似Puppeteer的networkidle0
async function waitForNetworkIdle(networkDomain, idleTime = 5000, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let lastRequestTime = Date.now();
    let isActive = true;
    
    // 设置超时
    const timeoutId = setTimeout(() => {
      isActive = false;
      console.log('网络空闲等待超时');
      resolve();
    }, timeout);
    
    // 监听网络请求
    networkDomain.requestWillBeSent(() => {
      if (isActive) {
        lastRequestTime = Date.now();
      }
    });
    
    // 检查网络是否空闲
    const checkInterval = setInterval(() => {
      if (!isActive) {
        clearInterval(checkInterval);
        return;
      }
      
      if (Date.now() - lastRequestTime >= idleTime) {
        clearTimeout(timeoutId);
        clearInterval(checkInterval);
        console.log('网络已空闲');
        resolve();
      }
    }, 100);
  });
}

// 处理数据并写入CSV文件
async function processAndWriteDataToCSV(data, filename, imagesDir) {
  try {
    // 处理数据中的图片
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
        const cell = row[cellIndex];
        // 检查是否是图片URL
        if (typeof cell === 'string' && (cell.startsWith('http://') || cell.startsWith('https://')) && 
            (cell.toLowerCase().includes('.jpg') || cell.toLowerCase().includes('.jpeg') || 
             cell.toLowerCase().includes('.png') || cell.toLowerCase().includes('.gif') ||
             cell.includes('uploadAction!'))) {
          // 下载图片并替换为相对路径
          const imagePath = await downloadImage(cell, imagesDir);
          // 将图片URL替换为相对路径
          row[cellIndex] = imagePath;
        }
      }
    }
    
    // 添加UTF-8 BOM以确保中文正确显示
    let csv = '\uFEFF';
    
    data.forEach(row => {
      // 处理每个字段，如果包含逗号、双引号或换行符，则用双引号包裹
      const processedRow = row.map(field => {
        // 转换为字符串
        const fieldStr = String(field);
        
        // 如果字段包含逗号、双引号或换行符，需要用双引号包裹
        if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
          // 将双引号转义为两个双引号
          return `"${fieldStr.replace(/"/g, '""')}"`;
        }
        
        return fieldStr;
      });
      
      // 用逗号连接字段并添加到CSV中
      csv += processedRow.join(',') + '\n';
    });
    
    // 写入文件
    fs.writeFileSync(filename, csv, 'utf8');
    console.log(`数据已成功写入 ${filename}`);
  } catch (err) {
    console.error('处理数据并写入CSV文件时出错:', err);
  }
}

// 使用axios下载图片并返回相对路径
async function downloadImage(url, imagesDir) {
  try {
    // 生成唯一的文件名
    const extension = path.extname(url).split('?')[0] || '.jpg'; // 默认扩展名
    const filename = `${Date.now()}_${Math.floor(Math.random() * 10000)}${extension}`;
    const filepath = path.join(imagesDir, filename);
    const relativePath = path.join(imagesDir, filename).replace(/\\/g, '/');
    
    // 使用axios下载图片
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    
    // 创建写入流并保存图片
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    
    // 等待写入完成
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    console.log(`图片已下载: ${relativePath}`);
    return relativePath;
  } catch (err) {
    console.error(`下载图片失败 ${url}:`, err.message);
    // 如果下载失败，返回原始URL
    return url;
  }
}

// 添加未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

connectToCurrentPage();