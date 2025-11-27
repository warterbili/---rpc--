const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// 用法说明
if (process.argv.length < 3) {
  console.log('用法: node process-js-file.js <操作> [参数]');
  console.log('操作:');
  console.log('  download <url> <output_file>    - 下载并保存gzip压缩的文件');
  console.log('  decompress <input_file> <output_file> - 解压gzip文件');
  console.log('  compress <input_file> <output_file>   - 压缩文件为gzip');
  console.log('  verify <file1> <file2>          - 比较两个文件是否相同');
  process.exit(1);
}

const operation = process.argv[2];

switch (operation) {
  case 'download':
    downloadAndSave(process.argv[3], process.argv[4]);
    break;
  case 'decompress':
    decompressFile(process.argv[3], process.argv[4]);
    break;
  case 'compress':
    compressFile(process.argv[3], process.argv[4]);
    break;
  case 'verify':
    verifyFiles(process.argv[3], process.argv[4]);
    break;
  default:
    console.log('未知操作:', operation);
    process.exit(1);
}

function downloadAndSave(url, outputFile) {
  console.log(`正在从 ${url} 下载文件...`);
  
  // 这里只是一个示例，实际使用时需要使用https模块下载文件
  console.log('请使用浏览器开发者工具或curl命令下载原始文件:');
  console.log(`curl -H "Accept-Encoding: gzip" "${url}" --output ${outputFile}`);
}

function decompressFile(inputFile, outputFile) {
  console.log(`正在解压 ${inputFile}...`);
  
  try {
    const compressedData = fs.readFileSync(inputFile);
    const decompressedData = zlib.gunzipSync(compressedData);
    fs.writeFileSync(outputFile, decompressedData);
    console.log(`文件已解压并保存为 ${outputFile}`);
    console.log(`原始大小: ${compressedData.length} 字节`);
    console.log(`解压后大小: ${decompressedData.length} 字节`);
  } catch (error) {
    console.error('解压文件时出错:', error.message);
  }
}

function compressFile(inputFile, outputFile) {
  console.log(`正在压缩 ${inputFile}...`);
  
  try {
    const rawData = fs.readFileSync(inputFile);
    const compressedData = zlib.gzipSync(rawData);
    fs.writeFileSync(outputFile, compressedData);
    console.log(`文件已压缩并保存为 ${outputFile}`);
    console.log(`原始大小: ${rawData.length} 字节`);
    console.log(`压缩后大小: ${compressedData.length} 字节`);
  } catch (error) {
    console.error('压缩文件时出错:', error.message);
  }
}

function verifyFiles(file1, file2) {
  console.log(`正在比较 ${file1} 和 ${file2}...`);
  
  try {
    const data1 = fs.readFileSync(file1);
    const data2 = fs.readFileSync(file2);
    
    const isSame = data1.equals(data2);
    
    if (isSame) {
      console.log('两个文件完全相同');
    } else {
      console.log('两个文件不相同');
      console.log(`文件1大小: ${data1.length} 字节`);
      console.log(`文件2大小: ${data2.length} 字节`);
    }
    
    // 计算并显示MD5哈希值
    const crypto = require('crypto');
    const hash1 = crypto.createHash('md5').update(data1).digest('hex');
    const hash2 = crypto.createHash('md5').update(data2).digest('hex');
    
    console.log(`文件1 MD5: ${hash1}`);
    console.log(`文件2 MD5: ${hash2}`);
    console.log(`MD5匹配: ${hash1 === hash2}`);
  } catch (error) {
    console.error('比较文件时出错:', error.message);
  }
}