@echo off
echo 正在下载原始JS文件...
curl -H "Accept-Encoding: gzip" "https://shopeefood.vn/app/assets/js/vendor-44af7fe3567cabf1519c.js" --output vendor-44af7fe3567cabf1519c.js.gz

echo.
echo 正在解压文件...
node process-js-file.js decompress vendor-44af7fe3567cabf1519c.js.gz vendor-44af7fe3567cabf1519c.js

echo.
echo 原始文件已准备就绪，您可以编辑 vendor-44af7fe3567cabf1519c.js 文件
echo 编辑完成后，运行 compress-js.bat 压缩文件
pause