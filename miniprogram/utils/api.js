const API_BASE = 'https://your-api-domain.com'

const request = (url, method = 'GET', data = {}) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data);
        } else {
          reject(res.data);
        }
      },
      fail: reject
    });
  });
};

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
  },

   // 视频解析
   parseVideo: (url) => request('/api/parse/video', 'POST', { url }),
  
   // 图片去水印
   removeWatermark: (imageUrl, maskData) => request('/api/image/remove', 'POST', { 
     imageUrl, 
     maskData 
   }),
   
   // 获取用户信息
   getUserInfo: () => request('/api/user/info'),
   
   // 获取使用次数
   getUsage: () => request('/api/user/usage'),
   
   // 广告回调
   adReward: () => request('/api/user/reward', 'POST')
}

