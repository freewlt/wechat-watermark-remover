// pages/profile/profile.js
Page({
  data: {
    isVip: false,
    usage: { today: 3, total: 0 },
    savedCount: 0,
    cacheSize: '0KB',
    version: '1.0.0'
  },

  onLoad() {
    this.loadData();
    this.calcCacheSize();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const usage = wx.getStorageSync('usage') || { today: 3, total: 0 };
    const savedCount = wx.getStorageSync('savedCount') || 0;
    
    this.setData({
      usage,
      savedCount,
      isVip: false // 从后端获取
    });
  },

  calcCacheSize() {
    // 简单估算
    const info = wx.getStorageInfoSync();
    const size = (info.currentSize / 1024).toFixed(2);
    this.setData({ cacheSize: size > 1 ? `${size}MB` : `${info.currentSize}KB` });
  },

  watchAd() {
    if (wx.createRewardedVideoAd) {
      const ad = wx.createRewardedVideoAd({ adUnitId: 'your-ad-unit-id' });
      
      ad.onLoad(() => {
        ad.show();
      });
      
      ad.onClose((res) => {
        if (res && res.isEnded) {
          const usage = wx.getStorageSync('usage') || { today: 0, total: 0 };
          usage.today += 3;
          wx.setStorageSync('usage', usage);
          this.setData({ usage });
          wx.showToast({ title: '获得3次机会', icon: 'success' });
        }
      });
      
      ad.onError(() => {
        wx.showToast({ title: '广告加载失败', icon: 'none' });
      });
      
      ad.load().catch(() => {});
    }
  },

  inviteFriend() {
    // 生成分享图或跳转邀请页面
    wx.showShareMenu({
      withShareTicket: true
    });
    wx.showToast({ title: '请点击右上角分享', icon: 'none' });
  },

  showHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  clearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理所有缓存数据吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorage();
          wx.showToast({ title: '清理完成', icon: 'success' });
          this.setData({ cacheSize: '0KB' });
        }
      }
    });
  },

  showAbout() {
    wx.showModal({
      title: '关于',
      content: '内容助手 v1.0.0\n\n一款简洁实用的视频解析与图片处理工具。',
      showCancel: false
    });
  },

  showAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  showPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goVip() {
    wx.navigateTo({ url: '/pages/vip/vip' });
  },

  onShareAppMessage() {
    return {
      title: '内容助手 - 免费视频下载工具',
      path: '/pages/index/index',
      imageUrl: '/images/share.png'
    };
  }
});