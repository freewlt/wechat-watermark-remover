// components/mask-canvas/mask-canvas.js
Component({
  properties: {
    // 画布宽度（rpx）
    width: {
      type: Number,
      value: 600
    },
    // 画布高度（rpx）
    height: {
      type: Number,
      value: 600
    },
    // 画笔大小（rpx）
    brushSize: {
      type: Number,
      value: 30
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
      this.initCanvas();
    }
  },

  methods: {
    // 初始化画布
    initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#mask-layer').fields({ node: true, size: true }).exec((res) => {
        if (res[0]) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 设置画布实际尺寸（考虑像素比）
          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          
          // 清空画布
          ctx.clearRect(0, 0, res[0].width, res[0].height);
          
          this.setData({ canvas, ctx });
          
          // 保存初始状态
          this.saveHistory();
          
          // 通知父组件就绪
          this.triggerEvent('ready', { canvas, ctx });
        }
      });
    },

    // 坐标转换
    getPosition(e) {
      const { clientX, clientY } = e.touches[0];
      const rect = this.data.canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    },

    onTouchStart(e) {
      if (this.properties.disabled || !this.data.ctx) return;
      
      const { x, y } = this.getPosition(e);
      
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