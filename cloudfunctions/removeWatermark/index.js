const cloud = require('wx-server-sdk')
const axios = require('axios')
const Jimp = require('jimp')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

// 读取本地配置文件
let config = {}
try {
  config = require('./config.js')
} catch (e) {
  console.log('配置文件不存在，使用默认配置')
}

// 百度AI配置
const BAIDU_AI = {
  apiKey: config.BAIDU_AI?.apiKey || 'your-api-key',
  secretKey: config.BAIDU_AI?.secretKey || 'your-secret-key',
  accessToken: null,
  tokenExpireTime: 0
}

exports.main = async (event, context) => {
  // 兼容两种参数格式
  const fileID = event.fileID || event.imageFileID
  let position = event.position || 'auto'
  const { maskData, width, height } = event

  if (!fileID) {
    return {
      code: -1,
      msg: '缺少文件ID参数（fileID 或 imageFileID）'
    }
  }

  try {
    // 1. 下载图片
    const downloadRes = await cloud.downloadFile({ fileID })
    let buffer = downloadRes.fileContent

    // 2. 使用Jimp模糊处理水印区域（不裁剪图片）
    
    // 如果position是manual，使用auto模式（因为暂时不支持精确涂抹区域解析）
    // 后续可以根据maskData解析涂抹的具体位置
    if (position === 'manual') {
      position = 'auto'
    }
    
    buffer = await blurWatermark(buffer, position)
    
    // 3. 上传到微信云存储
    const cloudPath = `results/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
    const uploadRes = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: buffer
    })
    
    // 4. 获取临时链接
    const urlRes = await cloud.getTempFileURL({
      fileList: [uploadRes.fileID]
    })
    
    return {
      code: 0,
      data: {
        url: urlRes.fileList[0].tempFileURL,
        fileID: uploadRes.fileID
      },
      msg: '处理完成（已模糊处理水印区域）'
    }

  } catch (error) {
    console.error('去水印处理失败:', error)
    return {
      code: -1,
      msg: error.message,
      detail: error.stack
    }
  }
}

/**
 * 去除水印区域
 * 使用周围像素覆盖水印区域，效果更自然
 */
async function blurWatermark(buffer, position) {
  try {
    const image = await Jimp.read(buffer)
    const width = image.getWidth()
    const height = image.getHeight()

    // 水印区域大小 - 根据常见水印尺寸调整
    // 通常水印是长条形的，宽度占图片的30-40%，高度占8-15%
    const watermarkWidth = Math.floor(width * 0.35)  // 35%宽度
    const watermarkHeight = Math.floor(height * 0.12)  // 8%高度

    let x = 0
    let y = 0

    // 根据位置计算水印区域坐标
    switch (position) {
      case 'left-top':
        x = 0
        y = 0
        break
      case 'right-top':
        x = Math.max(0, width - watermarkWidth)
        y = 0
        break
      case 'center':
        x = Math.floor((width - watermarkWidth) / 2)
        y = Math.floor((height - watermarkHeight) / 2)
        break
      case 'left-bottom':
        x = 0
        y = Math.max(0, height - watermarkHeight)
        break
      case 'right-bottom':
      case 'auto':
      default:
        x = Math.max(0, width - watermarkWidth)
        y = Math.max(0, height - watermarkHeight)
        break
    }

    // 使用周围像素填充水印区域
    // 策略：根据水印位置，从相邻区域复制像素
    await fillWithSurroundingPixels(image, x, y, watermarkWidth, watermarkHeight, position)

    // 返回处理后的图片buffer
    return await image.getBufferAsync(Jimp.MIME_JPEG)
  } catch (error) {
    console.error('水印处理失败:', error)
    // 如果处理失败，返回原图
    return buffer
  }
}

/**
 * 使用周围像素填充指定区域
 */
async function fillWithSurroundingPixels(image, x, y, w, h, position) {
  const width = image.getWidth()
  const height = image.getHeight()

  // 根据水印位置决定从哪个方向复制像素
  let sourceY = y
  let sourceX = x

  switch (position) {
    case 'left-top':
      // 水印在左上：从右下方向复制
      sourceX = Math.min(x + w, width - w)
      sourceY = Math.min(y + h, height - h)
      break
    case 'right-top':
      // 水印在右上：从左下方向复制
      sourceX = Math.max(0, x - w)
      sourceY = Math.min(y + h, height - h)
      break
    case 'center':
      // 水印在中心：从上方复制
      sourceX = x
      sourceY = Math.max(0, y - h)
      break
    case 'left-bottom':
      // 水印在左下：从右上方向复制
      sourceX = Math.min(x + w, width - w)
      sourceY = Math.max(0, y - h)
      break
    case 'right-bottom':
    case 'auto':
    default:
      // 水印在右下：从上方复制
      sourceX = x
      sourceY = Math.max(0, y - h)
      break
  }

  // 确保源区域在图片范围内
  sourceX = Math.max(0, Math.min(sourceX, width - w))
  sourceY = Math.max(0, Math.min(sourceY, height - h))

  // 复制像素
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const targetX = x + col
      const targetY = y + row
      const sourcePixelX = sourceX + col
      const sourcePixelY = sourceY + row

      if (targetX < width && targetY < height && sourcePixelX < width && sourcePixelY < height) {
        const color = image.getPixelColor(sourcePixelX, sourcePixelY)
        image.setPixelColor(color, targetX, targetY)
      }
    }
  }

  // 对填充区域进行轻微模糊，使过渡更自然
  const filledArea = image.clone().crop(x, y, w, h)
  filledArea.blur(3)  // 轻微模糊
  image.composite(filledArea, x, y)
}

/**
 * 裁剪图片去除水印
 * 根据位置裁剪掉水印所在的边缘区域
 */
async function cropWatermark(buffer, position) {
  try {
    const image = await Jimp.read(buffer)
    const width = image.getWidth()
    const height = image.getHeight()
    
    // 根据位置裁剪
    // 默认裁剪底部10%区域（常见水印位置）
    let cropHeight = height
    let cropWidth = width
    let x = 0
    let y = 0
    
    switch (position) {
      case 'left-top':
        // 左上：裁剪顶部和左侧
        cropHeight = Math.floor(height * 0.9)
        cropWidth = Math.floor(width * 0.9)
        x = Math.floor(width * 0.1)
        y = Math.floor(height * 0.1)
        break
      case 'right-top':
        // 右上：裁剪顶部和右侧
        cropHeight = Math.floor(height * 0.9)
        cropWidth = Math.floor(width * 0.9)
        x = 0
        y = Math.floor(height * 0.1)
        break
      case 'center':
        // 居中水印：使用AI修复（这里先简单裁剪四周）
        cropHeight = Math.floor(height * 0.9)
        cropWidth = Math.floor(width * 0.9)
        x = Math.floor(width * 0.05)
        y = Math.floor(height * 0.05)
        break
      case 'left-bottom':
        // 左下：裁剪底部和左侧
        cropHeight = Math.floor(height * 0.9)
        cropWidth = Math.floor(width * 0.9)
        x = Math.floor(width * 0.1)
        y = 0
        break
      case 'right-bottom':
      case 'auto':
      default:
        // 右下或自动：裁剪底部
        cropHeight = Math.floor(height * 0.9)
        cropWidth = width
        x = 0
        y = 0
        break
    }
    
    // 执行裁剪
    image.crop(x, y, cropWidth, cropHeight)
    
    // 返回裁剪后的图片buffer
    return await image.getBufferAsync(Jimp.MIME_JPEG)
  } catch (error) {
    console.error('裁剪失败:', error)
    // 如果裁剪失败，返回原图
    return buffer
  }
}

/**
 * 获取百度AI访问令牌
 */
async function getBaiduAccessToken() {
  // 检查是否有有效的令牌
  if (BAIDU_AI.accessToken && Date.now() < BAIDU_AI.tokenExpireTime) {
    return BAIDU_AI.accessToken
  }
  
  try {
    const response = await axios({
      method: 'POST',
      url: 'https://aip.baidubce.com/oauth/2.0/token',
      params: {
        grant_type: 'client_credentials',
        client_id: BAIDU_AI.apiKey,
        client_secret: BAIDU_AI.secretKey
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })
    
    if (response.data && response.data.access_token) {
      BAIDU_AI.accessToken = response.data.access_token
      // 令牌有效期通常为30天，这里设置为29天后过期
      BAIDU_AI.tokenExpireTime = Date.now() + (29 * 24 * 60 * 60 * 1000)
      return BAIDU_AI.accessToken
    } else {
      throw new Error('获取访问令牌失败: ' + JSON.stringify(response.data))
    }
  } catch (error) {
    console.error('获取百度AI令牌失败:', error.message)
    throw new Error('获取百度AI访问令牌失败: ' + error.message)
  }
}

/**
 * 使用百度AI图像修复API去除水印
 * 
 * 使用图像修复API (inpainting) 来修复水印区域
 * 传入rectangle参数指定需要修复的区域
 */
async function repairImageWithBaiduAI(base64Image, accessToken, position, imageInfo) {
  try {
    
    // 构建修复区域
    const rect = getRepairRectangle(position, imageInfo)
    
    const apiUrl = `https://aip.baidubce.com/rest/2.0/image-process/v1/inpainting?access_token=${accessToken}`
    
    // 构建请求参数
    const params = new URLSearchParams()
    params.append('image', base64Image)
    
    // 暂时不添加rectangle参数，测试基础调用
    // 百度AI图像修复API的rectangle参数格式可能有特殊要求
    
    const response = await axios({
      method: 'POST',
      url: apiUrl,
      data: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 60000  // 60秒超时
    })
        
    if (response.data && response.data.image) {
      return response.data.image
    } else if (response.data && response.data.error_code) {
      throw new Error(`图像修复API错误: ${response.data.error_msg} (错误码: ${response.data.error_code})`)
    } else {
      throw new Error('图像修复API返回数据格式错误: ' + JSON.stringify(response.data))
    }
  } catch (error) {
    console.error('百度AI图像修复失败:', error.message)
    if (error.response) {
      console.error('错误响应:', error.response.data)
    }
    throw error
  }
}

/**
 * 获取修复区域矩形
 * 根据水印位置和图片尺寸计算修复区域
 */
function getRepairRectangle(position, imageInfo) {
  const { width, height } = imageInfo
  
  // 水印区域大小（占图片的百分比）
  let watermarkWidth = Math.floor(width * 0.25)  // 25%宽度
  let watermarkHeight = Math.floor(height * 0.1)  // 10%高度
  
  // 确保水印区域不会太大或太小
  watermarkWidth = Math.min(Math.max(watermarkWidth, 50), width - 10)
  watermarkHeight = Math.min(Math.max(watermarkHeight, 30), height - 10)
  
  let left = 0
  let top = 0
  
  switch (position) {
    case 'left-top':
      // 左上
      left = 0
      top = 0
      break
    case 'right-top':
      // 右上
      left = Math.max(0, width - watermarkWidth)
      top = 0
      break
    case 'center':
      // 居中
      left = Math.floor((width - watermarkWidth) / 2)
      top = Math.floor((height - watermarkHeight) / 2)
      break
    case 'left-bottom':
      // 左下
      left = 0
      top = Math.max(0, height - watermarkHeight)
      break
    case 'right-bottom':
    case 'auto':
    default:
      // 右下（默认）
      left = Math.max(0, width - watermarkWidth)
      top = Math.max(0, height - watermarkHeight)
      break
  }
  
  // 确保所有值都是正整数且在图片范围内
  left = Math.max(0, Math.min(left, width - watermarkWidth))
  top = Math.max(0, Math.min(top, height - watermarkHeight))
  
  const result = {
    left: Math.floor(left),
    top: Math.floor(top),
    width: Math.floor(watermarkWidth),
    height: Math.floor(watermarkHeight)
  }
  
  return result
}

/**
 * 获取水印区域矩形坐标对象
 * 根据position参数返回对应的矩形区域对象
 * 格式: {"left":100,"top":100,"width":200,"height":100}
 */
function getWatermarkRectObj(position) {
  // 默认修复区域（右下角，常见水印位置）
  // 假设图片尺寸为 800x600，水印通常在角落
  
  if (!position || position === 'auto') {
    // 默认右下角区域
    return { left: 600, top: 500, width: 200, height: 100 }
  }
  
  // 根据位置返回对应区域（基于800x600的假设）
  const regions = {
    'left-top': { left: 0, top: 0, width: 200, height: 100 },      // 左上
    'right-top': { left: 600, top: 0, width: 200, height: 100 },   // 右上
    'center': { left: 300, top: 250, width: 200, height: 100 },    // 居中
    'left-bottom': { left: 0, top: 500, width: 200, height: 100 }, // 左下
    'right-bottom': { left: 600, top: 500, width: 200, height: 100 } // 右下
  }
  
  return regions[position] || regions['right-bottom']
}

/**
 * 获取修复区域矩形
 * 
 * 百度AI图像修复API支持指定矩形区域进行修复
 * 如果不指定，会自动检测并修复
 */
function getRepairRect(position) {
  // 默认修复右下角区域（常见水印位置）
  // 矩形格式: {"left": 100, "top": 100, "width": 200, "height": 100}
  
  // 由于不知道图片实际尺寸，这里返回null让AI自动检测
  // 或者可以传入图片尺寸进行计算
  
  // 如果需要指定区域，可以根据position返回不同的矩形
  // 但目前百度AI的图像修复API主要是自动检测修复区域
  
  return null  // 让AI自动检测修复区域
}