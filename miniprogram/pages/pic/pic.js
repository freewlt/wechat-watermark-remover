const app = getApp();

Page({
  data: {
    // 步骤控制：1选图 2编辑 3结果
    step: 1,
    
    // 图片数据
    originalImage: '',
    resultImage: '',
    
    // 画布尺寸
    canvasWidth: 300,
    canvasHeight: 300,
    
    // 画笔设置
    brushSize: 30,
    showMask: true,
    hasMask: false,
    
    // 状态
    processing: false,
    compareMode: false,
    
    // 撤销栈
    undoStack: [],
    
    // 系统信息
    pixelRatio: 1,
    windowWidth: 375
  },

  // 画布实例（不放入data避免触发渲染）
  editCanvas: null,
  editCtx: null,
  maskCanvas: null,
  maskCtx: null,
  
  // 绘制状态
  isDrawing: false,
  lastPoint: null,
  currentImageElement: null,

  onLoad(options) {
    // 获取系统信息
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      pixelRatio: sysInfo.pixelRatio,
      windowWidth: sysInfo.windowWidth
    });
  },

  onReady() {
    // 页面就绪后初始化画布
    this.initCanvasSystem();
  },

  onUnload() {
    // 清理资源
    this.currentImageElement = null;
  },

  // ========== 画布初始化 ==========
  
  initCanvasSystem() {
    const query = wx.createSelectorQuery();
    
    // 初始化编辑画布（底层 - 原图）
    query.select('#edit-canvas').fields({ 
      node: true, 
      size: true 
    }).exec((res) => {
      if (res[0] && res[0].node) {
        this.editCanvas = res[0].node;
        this.editCtx = this.editCanvas.getContext('2d');
        
        const dpr = this.data.pixelRatio;
        const width = res[0].width;
        const height = res[0].height;
        
        this.editCanvas.width = width * dpr;
        this.editCanvas.height = height * dpr;
        this.editCtx.scale(dpr, dpr);
      }
    });

    // 初始化遮罩画布（上层 - 涂抹）
    query.select('#mask-canvas').fields({ 
      node: true, 
      size: true 
    }).exec((res) => {
      if (res[0] && res[0].node) {
        this.maskCanvas = res[0].node;
        this.maskCtx = this.maskCanvas.getContext('2d');
        
        const dpr = this.data.pixelRatio;
        const width = res[0].width;
        const height = res[0].height;
        
        this.maskCanvas.width = width * dpr;
        this.maskCanvas.height = height * dpr;
        this.maskCtx.scale(dpr, dpr);
        
        // 初始清空
        this.maskCtx.clearRect(0, 0, width, height);
      }
    });
  },

  // ========== 图片选择 ==========

  chooseImage(e) {
    const sourceType = e && e.currentTarget && e.currentTarget.dataset 
      ? (e.currentTarget.dataset.source === 'camera' ? ['camera'] : ['album'])
      : ['album', 'camera'];

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: sourceType,
      success: (res) => {
        if (res.tempFiles && res.tempFiles[0]) {
          const tempFile = res.tempFiles[0];
          this.handleImageSelected(tempFile.tempFilePath);
        }
      },
      fail: (err) => {
        console.log('选择图片失败:', err);
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({
            title: '选择图片失败',
            icon: 'none'
          });
        }
      }
    });
  },

  handleImageSelected(imagePath) {
    // 获取图片信息
    wx.getImageInfo({
      src: imagePath,
      success: (info) => {
        const { width, height, path } = info;
        
        // 计算适配尺寸（保持比例）
        const maxWidth = this.data.windowWidth - 60; // 左右各30rpx边距
        const maxHeight = 700; // 最大高度限制
        
        let canvasWidth = width;
        let canvasHeight = height;
        
        // 计算缩放比例
        const scale = Math.min(
          maxWidth / width,
          maxHeight / height,
          1
        );
        
        if (scale < 1) {
          canvasWidth = Math.floor(width * scale);
          canvasHeight = Math.floor(height * scale);
        }

        this.setData({
          originalImage: path || imagePath,
          canvasWidth,
          canvasHeight,
          step: 2,
          hasMask: false,
          undoStack: [],
          resultImage: '',
          compareMode: false
        });

        // 延迟加载图片到画布（等待setData渲染完成）
        setTimeout(() => {
          this.loadImageToCanvas(path || imagePath, canvasWidth, canvasHeight);
        }, 100);
      },
      fail: (err) => {
        console.error('获取图片信息失败:', err);
        wx.showToast({
          title: '图片加载失败',
          icon: 'none'
        });
      }
    });
  },

  loadImageToCanvas(imagePath, width, height) {
    if (!this.editCanvas || !this.editCtx) {
      console.error('画布未初始化');
      // 重试
      setTimeout(() => {
        this.initCanvasSystem();
        setTimeout(() => this.loadImageToCanvas(imagePath, width, height), 100);
      }, 100);
      return;
    }

    try {
      const img = this.editCanvas.createImage();
      
      img.onload = () => {
        // 保存图片元素供后续使用
        this.currentImageElement = img;
        
        // 设置画布尺寸
        this.editCanvas.width = width * this.data.pixelRatio;
        this.editCanvas.height = height * this.data.pixelRatio;
        this.editCtx.scale(this.data.pixelRatio, this.data.pixelRatio);
        
        this.maskCanvas.width = width * this.data.pixelRatio;
        this.maskCanvas.height = height * this.data.pixelRatio;
        this.maskCtx.scale(this.data.pixelRatio, this.data.pixelRatio);
        
        // 绘制原图
        this.editCtx.clearRect(0, 0, width, height);
        this.editCtx.drawImage(img, 0, 0, width, height);
        
        // 清空遮罩层
        this.maskCtx.clearRect(0, 0, width, height);
        
        // 配置遮罩画笔
        this.setupMaskBrush();
      };
      
      img.onerror = (err) => {
        console.error('图片加载失败:', err);
        wx.showToast({ title: '图片加载失败', icon: 'none' });
      };
      
      img.src = imagePath;
      
    } catch (err) {
      console.error('加载图片到画布失败:', err);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  setupMaskBrush() {
    if (!this.maskCtx) return;
    
    this.maskCtx.lineCap = 'round';
    this.maskCtx.lineJoin = 'round';
    this.maskCtx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    this.maskCtx.lineWidth = this.data.brushSize;
  },

  // ========== 触摸绘制 ==========

  getTouchPosition(e) {
    const touch = e.touches[0];
    // 计算相对于画布的位置
    const rect = this.maskCanvas ? {
      left: 0,
      top: 0,
      width: this.data.canvasWidth,
      height: this.data.canvasHeight
    } : { left: 0, top: 0, width: 0, height: 0 };
    
    return {
      x: touch.x !== undefined ? touch.x : (touch.clientX - rect.left),
      y: touch.y !== undefined ? touch.y : (touch.clientY - rect.top)
    };
  },

  onTouchStart(e) {
    if (this.data.processing || !this.maskCtx) return;
    
    const pos = this.getTouchPosition(e);
    
    this.isDrawing = true;
    this.lastPoint = pos;
    
    // 开始新路径
    this.maskCtx.beginPath();
    this.maskCtx.moveTo(pos.x, pos.y);
    
    // 画起始点
    this.drawMaskPoint(pos.x, pos.y);
    
    if (!this.data.hasMask) {
      this.setData({ hasMask: true });
    }
  },

  onTouchMove(e) {
    if (!this.isDrawing || this.data.processing || !this.maskCtx) return;
    
    // 阻止默认滚动
    // e.preventDefault && e.preventDefault();
    
    const pos = this.getTouchPosition(e);
    
    // 画线
    this.maskCtx.lineTo(pos.x, pos.y);
    this.maskCtx.stroke();
    
    this.lastPoint = pos;
  },

  onTouchEnd() {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    this.lastPoint = null;
    
    // 保存撤销状态
    this.saveUndoState();
  },

  drawMaskPoint(x, y) {
    if (!this.maskCtx) return;
    
    const size = this.data.brushSize / 2;
    
    this.maskCtx.beginPath();
    this.maskCtx.arc(x, y, size, 0, Math.PI * 2);
    this.maskCtx.fillStyle = 'rgba(255, 0, 0, 0.6)';
    this.maskCtx.fill();
  },

  // ========== 工具方法 ==========

  onBrushSizeChange(e) {
    const size = e.detail.value;
    this.setData({ brushSize: size });
    
    if (this.maskCtx) {
      this.maskCtx.lineWidth = size;
    }
  },

  saveUndoState() {
    if (!this.maskCanvas) return;
    
    try {
      const imageData = this.maskCtx.getImageData(
        0, 0,
        this.maskCanvas.width,
        this.maskCanvas.height
      );
      
      const { undoStack } = this.data;
      const newStack = [...undoStack, imageData].slice(-10); // 最多10步
      
      this.setData({ undoStack: newStack });
    } catch (err) {
      console.error('保存撤销状态失败:', err);
    }
  },

  undo() {
    const { undoStack } = this.data;
    
    if (undoStack.length === 0) {
      wx.showToast({ title: '没有可撤销的', icon: 'none' });
      return;
    }
    
    // 移除最后一步
    const newStack = undoStack.slice(0, -1);
    this.setData({ undoStack: newStack });
    
    // 清空并恢复上一步
    const width = this.data.canvasWidth * this.data.pixelRatio;
    const height = this.data.canvasHeight * this.data.pixelRatio;
    this.maskCtx.clearRect(0, 0, width, height);
    
    if (newStack.length > 0) {
      const lastState = newStack[newStack.length - 1];
      this.maskCtx.putImageData(lastState, 0, 0);
    }
    
    // 更新hasMask状态
    this.setData({ hasMask: newStack.length > 0 });
  },

  clearMask() {
    if (!this.data.hasMask) {
      wx.showToast({ title: '没有涂抹内容', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有涂抹区域吗？',
      confirmColor: '#07c160',
      success: (res) => {
        if (res.confirm) {
          const width = this.data.canvasWidth * this.data.pixelRatio;
          const height = this.data.canvasHeight * this.data.pixelRatio;
          this.maskCtx.clearRect(0, 0, width, height);
          this.setData({ hasMask: false, undoStack: [] });
        }
      }
    });
  },

  toggleMask() {
    this.setData({ showMask: !this.data.showMask });
  },

  resetImage() {
    wx.showModal({
      title: '重新选择',
      content: '确定要重新选择图片吗？',
      confirmColor: '#07c160',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            step: 1,
            originalImage: '',
            resultImage: '',
            hasMask: false,
            undoStack: []
          });
        }
      }
    });
  },

  // ========== 图片处理 ==========

  async processImage() {
    if (!this.data.hasMask) {
      wx.showToast({ title: '请先涂抹水印区域', icon: 'none' });
      return;
    }
    
    // 检查使用次数
    const usage = wx.getStorageSync('usage') || { today: 3, total: 0, lastDate: '' };
    const today = new Date().toDateString();
    
    if (usage.lastDate !== today) {
      usage.today = 3;
      usage.lastDate = today;
    }
    
    if (usage.today <= 0) {
      wx.showModal({
        title: '次数用完',
        content: '今日免费次数已用完，观看广告可获得额外次数',
        confirmText: '看广告',
        success: (res) => {
          if (res.confirm) this.watchAd();
        }
      });
      return;
    }

    this.setData({ processing: true });
    wx.showLoading({ title: '处理中...', mask: true });

    try {
      // 1. 获取遮罩图片数据
      const maskDataUrl = this.maskCanvas.toDataURL('image/png');
      
      // 2. 上传原图到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `uploads/${Date.now()}_original.jpg`,
        filePath: this.data.originalImage
      });

      // 3. 调用云函数处理
      const { result } = await wx.cloud.callFunction({
        name: 'removeWatermark',
        data: {
          imageFileID: uploadRes.fileID,
          maskData: maskDataUrl,
          width: this.data.canvasWidth,
          height: this.data.canvasHeight
        }
      });

      if (result.code === 0) {
        // 更新次数
        usage.today--;
        usage.total++;
        wx.setStorageSync('usage', usage);
        
        this.setData({
          resultImage: result.data.url,
          step: 3,
          processing: false
        });
        
        wx.hideLoading();
      } else {
        throw new Error(result.msg || '处理失败');
      }
      
    } catch (err) {
      console.error('处理失败:', err);
      wx.hideLoading();
      wx.showToast({ 
        title: err.message || '处理失败，请重试', 
        icon: 'none',
        duration: 2000
      });
      this.setData({ processing: false });
    }
  },

  watchAd() {
    if (wx.createRewardedVideoAd) {
      const ad = wx.createRewardedVideoAd({ 
        adUnitId: 'your-ad-unit-id'
      });
      
      ad.onClose((res) => {
        if (res && res.isEnded) {
          const usage = wx.getStorageSync('usage') || { today: 0, total: 0 };
          usage.today += 3;
          wx.setStorageSync('usage', usage);
          wx.showToast({ title: '获得3次机会', icon: 'success' });
        }
      });
      
      ad.show().catch(() => {
        ad.load().then(() => ad.show()).catch(() => {
          wx.showToast({ title: '广告加载失败', icon: 'none' });
        });
      });
    }
  },

  toggleCompare() {
    this.setData({ compareMode: !this.data.compareMode });
  },

  previewImage() {
    wx.previewImage({
      urls: [this.data.resultImage]
    });
  },

  backToEdit() {
    this.setData({ step: 2 });
  },

  async saveImage() {
    if (!this.data.resultImage) {
      wx.showToast({ title: '没有可保存的图片', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const downloadRes = await wx.downloadFile({
        url: this.data.resultImage,
        timeout: 30000
      });

      if (downloadRes.statusCode === 200) {
        await wx.saveImageToPhotosAlbum({
          filePath: downloadRes.tempFilePath
        });
        
        const savedCount = (wx.getStorageSync('savedCount') || 0) + 1;
        wx.setStorageSync('savedCount', savedCount);
        
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        throw new Error('下载失败');
      }
    } catch (err) {
      console.error('保存失败:', err);
      
      if (err.errMsg && err.errMsg.includes('auth')) {
        wx.showModal({
          title: '需要授权',
          content: '请授权保存到相册权限',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    } finally {
      wx.hideLoading();
    }
  },

  processNew() {
    this.setData({
      step: 1,
      originalImage: '',
      resultImage: '',
      hasMask: false,
      undoStack: [],
      compareMode: false
    });
  }
});