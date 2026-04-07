// pages/video/video.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    url: '',
    loading: false,
    result: null,
    history: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 加载本地历史
    const history = wx.getStorageSync('videoHistory') || [];
    this.setData({ history: history.slice(0, 5) });
  },
  onInput(e) {
    this.setData({ url: e.detail.value });
  },
  
  async pasteUrl() {
    try {
      const { result } = await wx.getClipboardData();
      this.setData({ url: result });
      wx.showToast({ title: '已粘贴', icon: 'none' });
    } catch {
      wx.showToast({ title: '剪贴板为空', icon: 'none' });
    }
  },
  
  async parseVideo() {
    const { url } = this.data;
    
    // 简单验证
    if (!url.includes('http')) {
      wx.showToast({ title: '请输入有效链接', icon: 'none' });
      return;
    }
    
    this.setData({ loading: true });
    
    try {
      // 调用后端解析接口
      const { result } = await wx.cloud.callFunction({
        name: 'parseVideo',
        data: { url }
      });
      
      this.setData({ 
        result: result.data,
        loading: false 
      });
      
      // 保存历史
      this.saveHistory(result.data);
      
    } catch (err) {
      wx.showToast({ title: '解析失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },
  
  saveHistory(item) {
    let history = wx.getStorageSync('videoHistory') || [];
    history.unshift({ ...item, time: new Date().toLocaleString(), id: Date.now() });
    history = history.slice(0, 20);
    wx.setStorageSync('videoHistory', history);
    this.setData({ history: history.slice(0, 5) });
  },
  
  useHistory(e) {
    this.setData({ url: e.currentTarget.dataset.item.url });
  },
  
  downloadVideo() {
    const { videoUrl } = this.data.result;
    wx.showLoading({ title: '下载中...' });
    
    wx.downloadFile({
      url: videoUrl,
      success: (res) => {
        wx.saveVideoToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.showToast({ title: '保存成功' });
          },
          fail: () => {
            wx.showToast({ title: '保存失败，请检查权限', icon: 'none' });
          }
        });
      },
      fail: () => {
        wx.showToast({ title: '下载失败', icon: 'none' });
      },
      complete: () => wx.hideLoading()
    });
  },
  
  copyLink() {
    wx.setClipboardData({
      data: this.data.result.videoUrl,
      success: () => wx.showToast({ title: '链接已复制' })
    });
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})