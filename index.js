#!/usr/bin/env node
import inquirer from 'inquirer'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

/** 用户输入路径 */
function checkInput() {
  const promptList = [
    {
      type: 'input',
      message: '请输入分析项目路径：',
      name: 'path',
    },
  ]
  return inquirer.prompt(promptList)
}

/** 启动分析 */
async function start() {
  const { path } = await checkInput()
  const packagePath = path + '\\package.json'
  console.log('正在分析依赖项，请稍等...')
  /** 读取package.json下的所有dependencies依赖项，并用数组进行保存，package.json所在位置为packagePath */
  const dependencies = await getDependencies(packagePath)
  console.log('正在分析依赖项调用次数，请稍等...')
  /** 读取项目下的所有文件 */
  const files = await readFilesInDir(path)
  /** 收集dependencies里面每个依赖调用的次数，并给出调用路径 */
  const result = collectDependencies(files, dependencies)
  console.log('正在生成html文档，请稍等...')
  /** 生成一个html文档 */
  generateHtml(result)
  console.log('正在打开html文档，请稍等...')
  /** 浏览器打开html文档 */
  open('result.html')
}

/** 获取依赖项 */
function getDependencies(packagePath) {
  return new Promise((resolve) => {
    /** 读取package.json文件 */
    fs.readFile(packagePath, (err, data) => {
      if (err) throw err;
      const json = JSON.parse(data);
      const dependencies = Object.keys(json.dependencies || {})
      resolve(dependencies)
    })
  })
}

/** 获取path路径下的所有ts/js/tsx/jsx文件, 并读取这些文件 */
function readFilesInDir(dirPath) {
  const files = fs.readdirSync(dirPath)
  const result = []
  for (const filename of files) {
    const filePath = path.join(dirPath, filename)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      /** 判断是否是node_modules目录 */
      if (filename === 'node_modules') continue
      result.push(...readFilesInDir(filePath));
    } else if (/\.(ts|js|tsx|jsx)$/.test(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      result.push({ filePath, content });
    }
  }
  return result
}

/** 收集dependencies里面每个依赖调用的次数，并给出调用路径 */
function collectDependencies(files, dependencies) {
  const result = {}
  for (const dependency of dependencies) {
    result[dependency] = {
      count: 0,
      paths: [],
    }
  }
  for (const file of files) {
    const { filePath, content } = file
    for (const dependency of dependencies) {
      const reg = new RegExp(`\\b${dependency}\\b`, 'g')
      const count = (content.match(reg) || []).length
      if (count > 0) {
        result[dependency].count += count
        result[dependency].paths.push(filePath)
      }
    }
  }
  return result
}

/** 生成一个html文档 */
function generateHtml(result) {
  const html = `
    <html>
      <head>
        <title>依赖分析</title>
        <style>
          table {
            border-collapse: collapse;
          }
          table, th, td {
            border: 1px solid black;
          }
          th, td {
            padding: 10px;
          }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <th>依赖项</th>
            <th>调用次数</th>
            <th>调用路径</th>
          </tr>
          ${Object.keys(result).map((key) => {
            const { count, paths } = result[key]
            return `
              <tr>
                <td>${key}</td>
                <td>${count}</td>
                <td>${paths.join('<br/>')}</td>
              </tr>
            `
          }).join('')}
        </table>
      </body>
    </html>
  `
  fs.writeFileSync('result.html', html)
}

/** 浏览器打开html文档 */
function open(url) {
  switch (process.platform) {
    case 'darwin':
      exec(`open ${url}`)
      break
    case 'win32':
      exec(`start ${url}`)
      break
  }
}

start()