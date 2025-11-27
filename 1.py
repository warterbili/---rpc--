import asyncio
import os
from pyppeteer import launch

async def main():
    # 1. 启动浏览器
    browser = await launch(headless=False)
    page = await browser.newPage()
    
    # 2. 获取 CDP Client
    cdp = await page.target.createCDPSession()
    
    # 3. 启用 Fetch 域，并设置要拦截的请求模式
    await cdp.send('Fetch.enable', {
        'patterns': [
            {
                'urlPattern': "https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js", # 非常具体的目标URL
                # 或者使用更通用的模式：
                # 'urlPattern': '*.js', # 拦截所有JS文件（可能过多）
                'requestStage': 'Response' # 在响应阶段拦截
            }
        ]
    })
    
    # 4. 监听请求暂停事件
    @cdp.on('Fetch.requestPaused')
    async def on_request_paused(event):
        request_id = event['requestId']
        request_url = event['request']['url']
        
        print(f"拦截到请求: {request_url}")
        
        # 5. 定义本地文件映射规则
        # 例如：将URL中的文件名映射到本地目录
        filename = os.path.basename(request_url) # 获取 'app.js'
        local_file_path = f'./{filename}' # 映射到本地文件
        
        # 6. 检查本地文件是否存在
        if os.path.exists(local_file_path):
            print(f"  -> 找到本地替换文件: {local_file_path}")
            try:
                # 关键：以二进制模式读取，避免编码问题
                with open(local_file_path, 'rb') as f:
                    file_content = f.read()
                
                # 7. 履行请求，返回本地内容
                await cdp.send('Fetch.fulfillRequest', {
                    'requestId': request_id,
                    'responseCode': 200,
                    # body 需要是十六进制字符串
                    'body': file_content.hex(),
                    # ！！！关键：显式指定 body 长度，避免截断 ！！！
                    'bodyLength': len(file_content)
                })
                print(f"  -> 已成功替换为本地文件")
                return # 成功替换，函数返回
                
            except Exception as e:
                print(f"  -> 读取本地文件失败: {e}")
        
        # 8. 如果本地文件不存在，继续原来的网络请求
        print(f"  -> 未找到本地替换文件，继续网络请求")
        await cdp.send('Fetch.continueRequest', {'requestId': request_id})
    
    # 9. 开始导航
    await page.goto("https://shopeefood.vn/")
    
    # 保持浏览器打开一段时间以供测试
    await asyncio.sleep(60)
    await browser.close()

if __name__ == '__main__':
    asyncio.get_event_loop().run_until_complete(main())
