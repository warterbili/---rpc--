@echo off
echo 正在验证文件一致性...
node process-js-file.js verify vendor-44af7fe3567cabf1519c.js.gz vendor-44af7fe3567cabf1519c.js.gz.original

echo.
echo 验证完成
pause