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

        // 等待组件渲染完成
        setTimeout(() => {
        }, 200);
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
      // 检查是否还有绘制内容
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

  async processImage() {
    // 检查是否有涂抹内容
    const maskCanvasComponent = this.selectComponent('#maskCanvas');
    const hasDrawing = maskCanvasComponent && maskCanvasComponent.hasDrawing();

    // 如果没有涂抹，使用自动识别模式
    const position = hasDrawing ? 'manual' : 'auto';

    // 检查使用次数
    // const usage = wx.getStorageSync('usage') || { today: 3, total: 0, lastDate: '' };
    // const today = new Date().toDateString();

    // if (usage.lastDate !== today) {
    //   usage.today = 3;
    //   usage.lastDate = today;
    // }

    // if (usage.today <= 0) {
    //   wx.showModal({
    //     title: '次数用完',
    //     content: '今日免费次数已用完，观看广告可获得额外次数',
    //     confirmText: '看广告',
    //     success: (res) => {
    //       if (res.confirm) this.watchAd();
    //     }
    //   });
    //   return;
    // }

    this.setData({ processing: true });
    wx.showLoading({ title: hasDrawing ? '按涂抹区域处理中...' : '自动识别水印中...', mask: true });

    try {
      // 1. 获取遮罩图片数据（如果有涂抹）
      let maskDataUrl = null;
      if (hasDrawing) {
        maskDataUrl = this.getMaskData();
      } else {
      }

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
          height: this.data.canvasHeight,
          position: position
        }
      });

      if (result.code === 0) {
        // 更新次数
        // usage.today--;
        // usage.total++;
        // wx.setStorageSync('usage', usage);

        this.setData({
          resultImage: result.data.url,
          step: 3,
          processing: false
        });

        wx.hideLoading();
        wx.showToast({ title: '处理完成', icon: 'success' });
      } else {
        throw new Error(result.msg || '处理失败');
      }

    } catch (err) {
      console.error('处理失败:', err);
      wx.hideLoading();

      let errorMsg = '处理失败';
      if (err.errMsg && err.errMsg.includes('timeout')) {
        errorMsg = '处理超时，请重试或选择较小的图片';
      } else if (err.message) {
        errorMsg = err.message;
      }

      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 3000
      });
      this.setData({ processing: false });
    }
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