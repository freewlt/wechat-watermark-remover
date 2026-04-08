App({
  onLaunch() {
    console.log('去水印小程序启动')
    
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，无法使用云开发功能，请升级到最新微信版本。',
        showCancel: false
      })
    } else {
      wx.cloud.init({
        // 请替换为你的云开发环境ID
        // env: 'your-cloud-env-id',
        traceUser: true
      })
      console.log('云开发初始化成功')
    }
    
    // 检查更新
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(() => {
            wx.showModal({
              title: '更新提示',
              content: '新版本已准备好，是否重启？',
              success: (res) => {
                if (res.confirm) updateManager.applyUpdate()
              }
            })
          })
        }
      })
    }
  },

  globalData: {
    apiBaseUrl: 'https://your-api-domain.com'
  }
})
