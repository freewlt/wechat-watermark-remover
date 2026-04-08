const api = require('../../utils/api.js')

Page({
  data: {
    originalImage: '',
    originalFileID: '',
    resultImage: '',
    watermarkPosition: 'auto',
    isProcessing: false,
    progress: 0,
    processingText: '正在处理中...',
    // 水印区域选择（手动模式）
    watermarkBox: null,
    isSelectingBox: false
  },

  onLoad() {
    // 页面加载
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({
          originalImage: tempFilePath,
          resultImage: '',
          originalFileID: ''
        })
      }
    })
  },

  // 选择水印位置
  selectPosition(e) {
    const position = e.currentTarget.dataset.position
    this.setData({ watermarkPosition: position })
  },

  // 去除水印
  async removeWatermark() {
    const { originalImage, watermarkPosition, originalFileID } = this.data
    
    if (!originalImage) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    this.setData({ isProcessing: true, progress: 0 })

    // 模拟进度
    const progressTimer = setInterval(() => {
      let progress = this.data.progress
      if (progress < 90) {
        progress += Math.random() * 15
        this.setData({ progress: Math.min(progress, 90) })
      }
    }, 500)

    try {
      let fileID = originalFileID
      
      // 1. 如果还没有上传到云存储，先上传
      if (!fileID) {
        console.log('上传图片到云存储...')
        this.setData({ processingText: '正在上传图片...' })
        fileID = await this.uploadToCloud(originalImage)
        this.setData({ originalFileID: fileID })
      }

      // 2. 调用云函数去水印
      console.log('调用去水印云函数...')
      this.setData({ processingText: '正在去除水印...' })
      
      const result = await this.callRemoveWatermark(fileID, watermarkPosition)
      
      clearInterval(progressTimer)
      
      if (result.success) {
        this.setData({
          isProcessing: false,
          progress: 100,
          resultImage: result.imageUrl
        })
        wx.showToast({ title: '处理完成', icon: 'success' })
      } else {
        throw new Error(result.error || '处理失败')
      }
      
    } catch (error) {
      clearInterval(progressTimer)
      this.setData({ isProcessing: false })
      console.error('去水印失败:', error)
      wx.showToast({ 
        title: error.message || '处理失败', 
        icon: 'none',
        duration: 3000
      })
    }
  },

  // 上传图片到云存储
  uploadToCloud(filePath) {
    return new Promise((resolve, reject) => {
      const cloudPath = `uploads/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
      
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (res) => {
          console.log('上传成功, fileID:', res.fileID)
          resolve(res.fileID)
        },
        fail: (err) => {
          console.error('上传失败:', err)
          reject(new Error('图片上传失败'))
        }
      })
    })
  },

  // 调用去水印云函数
  callRemoveWatermark(fileID, position) {
    return new Promise((resolve, reject) => {
      console.log('开始调用云函数, fileID:', fileID)
      wx.cloud.callFunction({
        name: 'removeWatermark',
        data: {
          fileID: fileID,
          position: position,
          watermarkBox: this.data.watermarkBox
        },
        success: (res) => {
          console.log('云函数返回:', res.result)
          if (res.result && res.result.success) {
            resolve(res.result)
          } else {
            reject(new Error(res.result?.error || '云函数处理失败'))
          }
        },
        fail: (err) => {
          console.error('云函数调用失败:', err)
          // 提供更详细的错误信息
          let errorMsg = '去水印服务调用失败'
          if (err.errMsg) {
            if (err.errMsg.includes('not found')) {
              errorMsg = '云函数未部署，请先在开发者工具中部署 removeWatermark 云函数'
            } else if (err.errMsg.includes('timeout')) {
              errorMsg = '云函数调用超时，请重试'
            } else if (err.errMsg.includes('no permission')) {
              errorMsg = '没有云函数调用权限，请检查权限配置'
            }
          }
          reject(new Error(errorMsg))
        }
      })
    })
  },

  // 保存图片
  saveImage() {
    const { resultImage } = this.data
    
    if (!resultImage) {
      wx.showToast({ title: '没有可保存的图片', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '保存中...' })
    
    // 下载图片到本地
    wx.downloadFile({
      url: resultImage,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading()
              wx.showToast({ title: '保存成功', icon: 'success' })
            },
            fail: (err) => {
              wx.hideLoading()
              console.error('保存失败:', err)
              // 如果用户拒绝授权，提示手动保存
              if (err.errMsg && err.errMsg.includes('auth deny')) {
                wx.showModal({
                  title: '提示',
                  content: '需要授权保存到相册，请在设置中开启权限',
                  showCancel: false
                })
              } else {
                wx.showToast({ title: '保存失败', icon: 'none' })
              }
            }
          })
        } else {
          wx.hideLoading()
          wx.showToast({ title: '下载失败', icon: 'none' })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('下载失败:', err)
        wx.showToast({ title: '下载失败', icon: 'none' })
      }
    })
  },

  // 重置
  reset() {
    this.setData({
      originalImage: '',
      originalFileID: '',
      resultImage: '',
      watermarkPosition: 'auto',
      progress: 0,
      watermarkBox: null
    })
  },

  // 预览图片
  previewImage(e) {
    const { url } = e.currentTarget.dataset
    if (url) {
      wx.previewImage({
        urls: [url],
        current: url
      })
    }
  }
})
