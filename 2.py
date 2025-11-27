import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        # 1. 启动浏览器
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # 2. 启用网络拦截
        await page.route("**/*", handle_route)
        
        try:
            # 3. 开始导航（增加更长的超时时间）
            await page.goto("https://shopeefood.vn/", timeout=120000)
            
            # 保持浏览器打开一段时间以供测试
            await asyncio.sleep(60)
        except Exception as e:
            print(f"页面加载出错: {e}")
        finally:
            await browser.close()

async def handle_route(route):
    request = route.request
    url = request.url
    
    print(f"拦截到请求: {url}")
    
    # 检查是否是我们要拦截的特定JS文件
    if url == "https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js":
        # 定义本地文件映射规则
        filename = os.path.basename(url)  # 获取 'vendor-44af7fe3567cabf1519c.js'
        local_file_path = f'./{filename}'  # 映射到本地文件
        
        # 检查本地文件是否存在
        if os.path.exists(local_file_path):
            print(f"  -> 找到本地替换文件: {local_file_path}")
            try:
                # 读取本地文件内容
                with open(local_file_path, 'r', encoding='utf-8') as f:
                    file_content = f.read()
                
                # 拦截响应并返回本地内容
                await route.fulfill(
                    status=200,
                    content_type='application/javascript',
                    body=file_content
                )
                print(f"  -> 已成功替换为本地文件")
                return  # 成功替换，函数返回
            except Exception as e:
                print(f"  -> 读取本地文件失败: {e}")
    
    # 如果不是我们要拦截的请求，或者本地文件不存在，则继续原始请求
    print(f"  -> 继续网络请求")
    await route.continue_()

if __name__ == '__main__':
    # 使用现代的asyncio语法
    asyncio.run(main())
