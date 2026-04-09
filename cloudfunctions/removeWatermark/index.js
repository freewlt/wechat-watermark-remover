const cloud = require('wx-server-sdk')
const Jimp = require('jimp')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

// 最大处理尺寸，防止内存溢出
const MAX_PROCESS_SIZE = 1920

exports.main = async (event, context) => {
  const fileID = event.fileID || event.imageFileID
  const position = event.position || 'auto'

  if (!fileID) {
    return {
      code: -1,
      msg: '缺少文件ID参数'
    }
  }

  try {
    console.log('开始处理图片，fileID:', fileID, 'position:', position)

    // 1. 下载图片
    const downloadRes = await cloud.downloadFile({ fileID })
    let buffer = downloadRes.fileContent
    console.log('图片下载成功，大小:', buffer.length)

    // 2. 使用 Jimp 处理水印
    buffer = await processWatermark(buffer, position)
    console.log('水印处理完成，新大小:', buffer.length)

    // 3. 上传到微信云存储
    const cloudPath = `results/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
    const uploadRes = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: buffer
    })
    console.log('上传成功:', uploadRes.fileID)

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
      msg: '处理完成'
    }

  } catch (error) {
    console.error('处理失败:', error)
    return {
      code: -1,
      msg: error.message || '处理失败'
    }
  }
}

/**
 * 处理水印 - 使用模糊处理
 */
async function processWatermark(buffer, position) {
  try {
    // 读取图片
    const image = await Jimp.read(buffer)
    const width = image.getWidth()
    const height = image.getHeight()

    console.log('原始图片尺寸:', width, 'x', height)

    // 如果图片太大，先缩小
    let processedImage = image
    if (width > MAX_PROCESS_SIZE || height > MAX_PROCESS_SIZE) {
      const scale = MAX_PROCESS_SIZE / Math.max(width, height)
      const newWidth = Math.floor(width * scale)
      const newHeight = Math.floor(height * scale)
      processedImage = image.resize(newWidth, newHeight)
      console.log('图片已缩放至:', newWidth, 'x', newHeight)
    }

    const finalWidth = processedImage.getWidth()
    const finalHeight = processedImage.getHeight()

    // 获取水印区域
    const rect = getWatermarkRect(position, finalWidth, finalHeight)
    console.log('水印区域:', rect)

    if (!rect) {
      console.log('未识别到水印区域，返回原图')
      return await processedImage.getBufferAsync(Jimp.MIME_JPEG)
    }

    // 提取水印区域并模糊处理
    const watermarkArea = processedImage.clone().crop(
      rect.left,
      rect.top,
      rect.width,
      rect.height
    )

    // 应用高斯模糊
    watermarkArea.blur(8)

    // 将模糊后的区域合成回原图
    processedImage.composite(watermarkArea, rect.left, rect.top)

    console.log('水印处理完成')
    return await processedImage.getBufferAsync(Jimp.MIME_JPEG)

  } catch (error) {
    console.error('Jimp处理失败:', error)
    // 返回原图
    return buffer
  }
}

/**
 * 根据位置获取水印区域坐标
 */
function getWatermarkRect(position, imageWidth, imageHeight) {
  // 水印区域大小 - 根据常见水印尺寸调整
  const watermarkWidth = Math.floor(imageWidth * 0.35)
  const watermarkHeight = Math.floor(imageHeight * 0.1)

  switch (position) {
    case 'top-left':
      return {
        left: 0,
        top: 0,
        width: watermarkWidth,
        height: watermarkHeight
      }
    case 'top-right':
      return {
        left: imageWidth - watermarkWidth,
        top: 0,
        width: watermarkWidth,
        height: watermarkHeight
      }
    case 'bottom-left':
      return {
        left: 0,
        top: imageHeight - watermarkHeight,
        width: watermarkWidth,
        height: watermarkHeight
      }
    case 'bottom-right':
    case 'auto':
    default:
      return {
        left: imageWidth - watermarkWidth,
        top: imageHeight - watermarkHeight,
        width: watermarkWidth,
        height: watermarkHeight
      }
  }
}
