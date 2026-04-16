App({
  onLaunch() {
    console.log('去水印小程序启动')

    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-6g4xmvjn7eaffb5c',
      traceUser: true
    })

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

  globalData: {}
})
