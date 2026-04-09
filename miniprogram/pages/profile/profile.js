// pages/profile/profile.js
Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    isVip: false,
    usage: { today: 3, total: 0 },
    savedCount: 0,
    cacheSize: '0KB',
    version: '4.0.0'
  },

  onLoad() {
    this.loadData();
    this.calcCacheSize();
    this.checkLoginStatus();
  },

  onShow() {
    this.loadData();
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo
      });
    }
  },

  // 点击用户卡片
  onUserCardTap() {
    if (this.data.isLoggedIn) {
      // 已登录，显示退出登录选项
      wx.showActionSheet({
        itemList: ['退出登录'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.logout();
          }
        }
      });
    } else {
      // 未登录，执行登录
      this.login();
    }
  },

  // 登录
  login() {
    wx.showLoading({ title: '登录中...' });

    // 获取用户信息
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = res.userInfo;

        // 保存用户信息
        wx.setStorageSync('userInfo', userInfo);

        this.setData({
          isLoggedIn: true,
          userInfo: userInfo
        });

        wx.hideLoading();
        wx.showToast({ title: '登录成功', icon: 'success' });

        // 可以在这里调用云函数保存用户信息到数据库
        this.saveUserInfoToCloud(userInfo);
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('登录失败:', err);
        wx.showToast({ title: '登录取消', icon: 'none' });
      }
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          this.setData({
            isLoggedIn: false,
            userInfo: null
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  // 保存用户信息到云端
  saveUserInfoToCloud(userInfo) {
    wx.cloud.callFunction({
      name: 'saveUserInfo',
      data: {
        userInfo: userInfo,
        loginTime: new Date().getTime()
      }
    }).catch(err => {
      console.error('保存用户信息失败:', err);
    });
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
      content: '内容助手 v4.0.0\n\n一款简洁实用的视频解析与图片处理工具。',
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