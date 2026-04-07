const API_BASE = 'https://your-api-domain.com'

module.exports = {
  // 上传图片
  uploadImage(filePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${API_BASE}/api/upload`,
        filePath: filePath,
        name: 'file',
        success: (res) => {
          const data = JSON.parse(res.data)
          resolve(data)
        },
        fail: reject
      })
    })
  },

  // 去除水印
  removeWatermark(imageUrl, position) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${API_BASE}/api/remove-watermark`,
        method: 'POST',
        data: { imageUrl, position },
        success: (res) => resolve(res.data),
        fail: reject
      })
    })
  }
}