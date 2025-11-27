@echo off
echo 正在压缩本地JS文件...
node process-js-file.js compress vendor-44af7fe3567cabf1519c.js vendor-44af7fe3567cabf1519c.js.gz

echo.
echo 文件已压缩完成，可以运行 enhanced-intercept.js 进行拦截测试
pause