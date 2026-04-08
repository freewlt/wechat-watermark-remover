// components/mask-canvas/mask-canvas.js
Component({
  properties: {
    // 画布宽度（px）
    width: {
      type: Number,
      value: 300
    },
    // 画布高度（px）
    height: {
      type: Number,
      value: 300
    },
    // 画笔大小（px）
    brushSize: {
      type: Number,
      value: 15
    },
    // 画笔颜色
    brushColor: {
      type: String,
      value: 'rgba(255, 0, 0, 0.5)'
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    },
    // 是否显示光标
    showCursor: {
      type: Boolean,
      value: false
    }
  },

  data: {
    canvas: null,
    ctx: null,
    isDrawing: false,
    cursorX: 0,
    cursorY: 0,
    // 历史记录栈
    historyStack: [],
    historyIndex: -1
  },

  lifetimes: {
    attached() {
      // 延迟初始化，等待属性传入
      setTimeout(() => {
        if (this.properties.width && this.properties.height) {
          this.initCanvas();
        }
      }, 100);
    }
  },

  observers: {
    'width, height': function(width, height) {
      console.log('属性变化 - width:', width, 'height:', height);
      if (width && height && !this.data.canvas) {
        this.initCanvas();
      }
    }
  },

  methods: {
    // 初始化画布
    initCanvas() {
      console.log('开始初始化画布, width:', this.properties.width, 'height:', this.properties.height);
      const query = this.createSelectorQuery();
      query.select('#mask-layer').fields({ node: true, size: true }).exec((res) => {
        console.log('canvas query result:', res);
        if (res[0]) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 设置画布实际尺寸（考虑像素比）
          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          
          console.log('画布尺寸:', res[0].width, 'x', res[0].height, 'dpr:', dpr);
          
          // 清空画布
          ctx.clearRect(0, 0, res[0].width, res[0].height);
          
          this.setData({ canvas, ctx });
          
          // 配置画笔
          this.setupBrush();
          
          // 保存初始状态
          this.saveHistory();
          
          // 通知父组件就绪
          this.triggerEvent('ready', { canvas, ctx });
          console.log('画布初始化完成');
        } else {
          console.error('canvas query failed, res:', res);
        }
      });
    },

    // 坐标转换 - 使用触摸事件的坐标
    getPosition(e) {
      const touch = e.touches[0];
      // 直接使用相对于画布的坐标
      return {
        x: touch.x,
        y: touch.y
      };
    },

    onTouchStart(e) {
      console.log('onTouchStart', e);
      if (this.properties.disabled || !this.data.ctx) {
        console.log('触摸被禁用或ctx不存在');
        return;
      }
      
      // 确保画笔已配置
      this.setupBrush();
      
      const { x, y } = this.getPosition(e);
      console.log('触摸坐标:', x, y);
      
      this.setData({ 
        isDrawing: true,
        cursorX: x,
        cursorY: y
      });
      
      const ctx = this.data.ctx;
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      // 绘制起点
      this.drawPoint(x, y);
      
      // 通知父组件有变化
      this.triggerEvent('change', { hasDrawing: true });
    },

    onTouchMove(e) {
      if (!this.data.isDrawing || this.properties.disabled) return;
      
      const { x, y } = this.getPosition(e);
      
      this.setData({
        cursorX: x,
        cursorY: y
      });
      
      const ctx = this.data.ctx;
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // 通知父组件正在绘制
      this.triggerEvent('drawing', { x, y });
    },

    onTouchEnd() {
      if (!this.data.isDrawing) return;
      
      this.setData({ isDrawing: false });
      this.saveHistory();
      
      // 通知父组件绘制完成
      this.triggerEvent('drawend');
    },

    onTouchCancel() {
      this.setData({ isDrawing: false });
    },

    // 绘制单个点
    drawPoint(x, y) {
      const ctx = this.data.ctx;
      const { brushSize, brushColor } = this.properties;
      
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = brushColor;
      ctx.fill();
    },

    // 配置画笔
    setupBrush() {
      const ctx = this.data.ctx;
      const { brushSize, brushColor } = this.properties;
      
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = brushColor;
    },

    // 保存历史（用于撤销）
    saveHistory() {
      const { historyStack, historyIndex } = this.data;
      const imageData = this.data.ctx.getImageData(
        0, 0, 
        this.data.canvas.width, 
        this.data.canvas.height
      );
      
      // 删除当前位置之后的历史
      const newStack = historyStack.slice(0, historyIndex + 1);
      newStack.push(imageData);
      
      // 限制历史记录数量
      if (newStack.length > 10) {
        newStack.shift();
      }
      
      this.setData({
        historyStack: newStack,
        historyIndex: newStack.length - 1
      });
    },

    // 撤销
    undo() {
      const { historyStack, historyIndex } = this.data;
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        const imageData = historyStack[newIndex];
        this.data.ctx.putImageData(imageData, 0, 0);
        this.setData({ historyIndex: newIndex });
        return true;
      }
      return false;
    },

    // 重做
    redo() {
      const { historyStack, historyIndex } = this.data;
      if (historyIndex < historyStack.length - 1) {
        const newIndex = historyIndex + 1;
        const imageData = historyStack[newIndex];
        this.data.ctx.putImageData(imageData, 0, 0);
        this.setData({ historyIndex: newIndex });
        return true;
      }
      return false;
    },

    // 清空
    clear() {
      const ctx = this.data.ctx;
      const canvas = this.data.canvas;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.saveHistory();
    },

    // 获取遮罩数据（base64）
    getMaskData() {
      return this.data.canvas.toDataURL('image/png');
    },

    // 获取遮罩ImageData
    getImageData() {
      return this.data.ctx.getImageData(
        0, 0,
        this.data.canvas.width,
        this.data.canvas.height
      );
    },

    // 判断是否有绘制内容
    hasDrawing() {
      const imageData = this.getImageData();
      const data = imageData.data;
      // 检查是否有非透明像素
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return true;
      }
      return false;
    }
  }
});