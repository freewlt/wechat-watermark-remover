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
    isDrawing: false,

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
    return new Promise((resolve, reject) => {
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

          // 初始化遮罩画布（上层 - 涂抹）
          const query2 = wx.createSelectorQuery();
          query2.select('#mask-canvas').fields({
            node: true,
            size: true
          }).exec((res2) => {
            if (res2[0] && res2[0].node) {
              this.maskCanvas = res2[0].node;
              this.maskCtx = this.maskCanvas.getContext('2d');

              this.maskCanvas.width = width * dpr;
              this.maskCanvas.height = height * dpr;
              this.maskCtx.scale(dpr, dpr);

              // 初始清空
              this.maskCtx.clearRect(0, 0, width, height);

              resolve();
            } else {
              reject(new Error('遮罩画布初始化失败'));
            }
          });
        } else {
          reject(new Error('编辑画布初始化失败'));
        }
      });
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
        // 限制最大尺寸，避免内存问题和 canvas 过大
        const sysInfo = wx.getSystemInfoSync();
        const maxWidth = sysInfo.windowWidth - 40; // 左右各20px边距
        const maxHeight = Math.min(sysInfo.windowHeight * 0.5, 600); // 最大高度为屏幕高度的50%或600px

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

        // 确保尺寸不超过限制（防止内存溢出和数据传输过大）
        const MAX_CANVAS_SIZE = 1024; // 限制最大尺寸为 1024，平衡性能和内存
        if (canvasWidth > MAX_CANVAS_SIZE || canvasHeight > MAX_CANVAS_SIZE) {
          const maxScale = MAX_CANVAS_SIZE / Math.max(canvasWidth, canvasHeight);
          canvasWidth = Math.floor(canvasWidth * maxScale);
          canvasHeight = Math.floor(canvasHeight * maxScale);
        }

        console.log('图片尺寸:', width, 'x', height, '画布尺寸:', canvasWidth, 'x', canvasHeight);

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

        // 等待组件渲染完成后重置 mask-canvas
        setTimeout(() => {
          const maskCanvasComponent = this.selectComponent('#maskCanvas');
          if (maskCanvasComponent) {
            maskCanvasComponent.reset();
          }
        }, 300);
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



  // ========== Mask Canvas 组件事件 ==========

  onMaskCanvasReady(e) {
    this.maskCanvas = e.detail.canvas;
    this.maskCtx = e.detail.ctx;
  },

  onMaskChange(e) {
    if (!this.data.hasMask) {
      this.setData({ hasMask: true });
    }
  },

  onMaskDrawing(e) {
    this.setData({ isDrawing: e.detail ? e.detail.isDrawing : false });
  },

  // 获取遮罩数据（用于提交处理）
  getMaskData() {
    const maskCanvasComponent = this.selectComponent('#maskCanvas');
    if (maskCanvasComponent) {
      return maskCanvasComponent.getMaskData();
    }
    return null;
  },

  // ========== 工具方法 ==========

  onBrushSizeChange(e) {
    const size = e.detail.value;
    this.setData({ brushSize: size });
    
    // 更新组件的画笔大小
    const maskCanvasComponent = this.selectComponent('#maskCanvas');
    if (maskCanvasComponent) {
      // 通过设置属性更新画笔大小
      // 注意：组件内部应该监听 brushSize 变化
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
    const maskCanvasComponent = this.selectComponent('#maskCanvas');
    if (maskCanvasComponent && maskCanvasComponent.undo()) {
      const hasDrawing = maskCanvasComponent.hasDrawing();
      this.setData({ hasMask: hasDrawing });
    } else {
      wx.showToast({ title: '没有可撤销的', icon: 'none' });
    }
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
          const maskCanvasComponent = this.selectComponent('#maskCanvas');
          if (maskCanvasComponent) {
            maskCanvasComponent.clear();
          }
          this.setData({ hasMask: false });
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

  // 涂抹修复模式（需要先涂抹）
  async processRepair() {
    const maskCanvasComponent = this.selectComponent('#maskCanvas');
    if (!maskCanvasComponent || !maskCanvasComponent.hasDrawing()) {
      wx.showToast({ title: '请先涂抹水印区域', icon: 'none' });
      return;
    }

    this.setData({ processing: true });

    let offscreenCanvas;
    try {
      const query = this.createSelectorQuery();
      offscreenCanvas = await new Promise((resolve, reject) => {
        query.select('#offscreen-canvas').fields({ node: true }).exec((res) => {
          if (res[0] && res[0].node) resolve(res[0].node);
          else reject(new Error('离屏 canvas 获取失败'));
        });
      });
    } catch (err) {
      wx.showToast({ title: err.message || '初始化失败', icon: 'none' });
      this.setData({ processing: false });
      return;
    }

    wx.showLoading({ title: '修复中...', mask: true });
    try {
      const resultPath = await maskCanvasComponent.repairImage(
        this.data.originalImage,
        'fine',
        offscreenCanvas
      );
      this.setData({ resultImage: resultPath, step: 3, processing: false });
      wx.hideLoading();
      wx.showToast({ title: '处理完成', icon: 'success' });
    } catch (err) {
      console.error('修复失败:', err);
      wx.hideLoading();
      wx.showToast({ title: err.message || '处理失败', icon: 'none', duration: 3000 });
      this.setData({ processing: false });
    }
  },

  // 自动去水印模式（无需涂抹）
  async autoRemoveWatermark() {
    // 先弹确认提示，说明适用场景
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '⚠️ 使用前请确认',
        content: '自动去水印适合去除半透明平铺水印（如旅拍水印、心形水印）。\n\n如果图片本身有大面积白色内容（如白底文字、截图），请改用"涂抹修复"以避免误处理。\n\n是否继续？',
        confirmText: '继续',
        cancelText: '取消',
        confirmColor: '#07c160',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) return;

    const maskCanvasComponent = this.selectComponent('#maskCanvas');

    this.setData({ processing: true });

    let offscreenCanvas;
    try {
      const query = this.createSelectorQuery();
      offscreenCanvas = await new Promise((resolve, reject) => {
        query.select('#offscreen-canvas').fields({ node: true }).exec((res) => {
          if (res[0] && res[0].node) resolve(res[0].node);
          else reject(new Error('离屏 canvas 获取失败'));
        });
      });
    } catch (err) {
      wx.showToast({ title: err.message || '初始化失败', icon: 'none' });
      this.setData({ processing: false });
      return;
    }

    wx.showLoading({ title: '自动去水印中...', mask: true });
    try {
      const resultPath = await maskCanvasComponent.removeOverlayWatermark(
        this.data.originalImage,
        offscreenCanvas,
        { detectKernel: 60, brightThreshold: 20, satLoss: 18, dilateRadius: 2, fillRadius: 8 }
      );
      this.setData({ resultImage: resultPath, step: 3, processing: false });
      wx.hideLoading();
      wx.showToast({ title: '去水印完成', icon: 'success' });
    } catch (err) {
      console.error('去水印失败:', err);
      wx.hideLoading();
      wx.showToast({ title: err.message || '去水印失败', icon: 'none', duration: 3000 });
      this.setData({ processing: false });
    }
  },

  // 兼容旧入口（保留不删）
  async processImage() {
    const maskCanvasComponent = this.selectComponent('#maskCanvas');
    if (maskCanvasComponent && maskCanvasComponent.hasDrawing()) {
      return this.processRepair();
    }
    return this.autoRemoveWatermark();
  },

  // watchAd() {
  //   if (wx.createRewardedVideoAd) {
  //     const ad = wx.createRewardedVideoAd({ 
  //       adUnitId: 'your-ad-unit-id'
  //     });
      
  //     ad.onClose((res) => {
  //       if (res && res.isEnded) {
  //         const usage = wx.getStorageSync('usage') || { today: 0, total: 0 };
  //         usage.today += 3;
  //         wx.setStorageSync('usage', usage);
  //         wx.showToast({ title: '获得3次机会', icon: 'success' });
  //       }
  //     });
      
  //     ad.show().catch(() => {
  //       ad.load().then(() => ad.show()).catch(() => {
  //         wx.showToast({ title: '广告加载失败', icon: 'none' });
  //       });
  //     });
  //   }
  // },

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

  saveImage() {
    const { resultImage } = this.data;

    if (!resultImage) {
      wx.showToast({ title: '没有可保存的图片', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    wx.saveImageToPhotosAlbum({
      filePath: resultImage,
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '保存成功', icon: 'success' });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存失败:', err);
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要授权',
            content: '请在设置中开启相册写入权限',
            showCancel: false
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
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