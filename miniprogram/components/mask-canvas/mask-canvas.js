// components/mask-canvas/mask-canvas.js
Component({
  properties: {
    width: {
      type: Number,
      value: 300
    },
    height: {
      type: Number,
      value: 300
    },
    brushSize: {
      type: Number,
      value: 15
    },
    brushColor: {
      type: String,
      value: 'rgba(255, 0, 0, 0.5)'
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    canvas: null,
    ctx: null,
    isDrawing: false,
    historyStack: [],
    historyIndex: -1
  },

  lifetimes: {
    ready() {
      // 页面就绪后初始化
      this.initCanvas();
    }
  },

  observers: {
    'width, height': function(width, height) {
      if (width && height) {
        // 尺寸变化时重新初始化
        this.initCanvas();
      }
    }
  },

  methods: {
    // 初始化画布
    initCanvas() {
      const { width, height } = this.properties;
      if (!width || !height) return;

      console.log('初始化画布:', width, 'x', height);

      const query = this.createSelectorQuery();
      query.select('#mask-layer').fields({ node: true, size: true }).exec((res) => {
        if (!res[0]) {
          console.error('canvas 未找到');
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        // 设置画布尺寸（使用逻辑像素，不乘以 dpr 避免过大）
        canvas.width = width;
        canvas.height = height;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 配置画笔
        ctx.lineWidth = this.properties.brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.properties.brushColor;

        this.setData({ canvas, ctx });

        // 保存初始状态
        this.saveHistory();

        // 通知父组件就绪
        this.triggerEvent('ready', { canvas, ctx });
        console.log('画布初始化完成');
      });
    },

    // 获取触摸坐标（相对于 canvas）
    getPosition(e) {
      const touch = e.touches[0];
      return {
        x: touch.x,
        y: touch.y
      };
    },

    onTouchStart(e) {
      if (this.properties.disabled || !this.data.ctx) {
        console.log('触摸被禁用或 ctx 不存在');
        return;
      }

      const { x, y } = this.getPosition(e);
      console.log('触摸开始:', x, y);

      this.setData({ isDrawing: true });

      const ctx = this.data.ctx;
      ctx.beginPath();
      ctx.moveTo(x, y);

      // 绘制起点
      ctx.beginPath();
      ctx.arc(x, y, this.properties.brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = this.properties.brushColor;
      ctx.fill();

      // 通知父组件
      this.triggerEvent('change', { hasDrawing: true });
    },

    onTouchMove(e) {
      if (!this.data.isDrawing || this.properties.disabled || !this.data.ctx) {
        return;
      }

      const { x, y } = this.getPosition(e);

      const ctx = this.data.ctx;
      ctx.beginPath();
      ctx.strokeStyle = this.properties.brushColor;
      ctx.lineWidth = this.properties.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();

      // 移动画笔起点
      ctx.moveTo(x, y);
    },

    onTouchEnd() {
      if (!this.data.isDrawing) return;

      this.setData({ isDrawing: false });
      this.saveHistory();

      this.triggerEvent('drawend');
      console.log('触摸结束');
    },

    onTouchCancel() {
      this.setData({ isDrawing: false });
    },

    // 保存历史记录
    saveHistory() {
      if (!this.data.canvas) return;

      const ctx = this.data.ctx;
      const imageData = ctx.getImageData(0, 0, this.properties.width, this.properties.height);

      const { historyStack, historyIndex } = this.data;
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
      const { historyStack, historyIndex, ctx } = this.data;
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        const imageData = historyStack[newIndex];
        ctx.putImageData(imageData, 0, 0);
        this.setData({ historyIndex: newIndex });
        return true;
      }
      return false;
    },

    // 清空
    clear() {
      if (!this.data.ctx) return;
      const ctx = this.data.ctx;
      ctx.clearRect(0, 0, this.properties.width, this.properties.height);
      this.saveHistory();
      this.triggerEvent('change', { hasDrawing: false });
    },

    // 获取画布数据（兼容旧接口名）
    getMaskData() {
      if (!this.data.canvas) return null;
      return this.data.ctx.getImageData(0, 0, this.properties.width, this.properties.height);
    },

    // 获取画布数据（新接口名）
    getImageData() {
      if (!this.data.canvas) return null;
      return this.data.ctx.getImageData(0, 0, this.properties.width, this.properties.height);
    },

    // 检查是否有涂抹内容
    hasDrawing() {
      return this.data.historyIndex > 0;
    },

    // 重置画布（切换图片时调用）
    reset() {
      if (!this.data.ctx) return;

      const ctx = this.data.ctx;
      const { width, height } = this.properties;

      // 清空画布
      ctx.clearRect(0, 0, width, height);

      // 重置历史记录
      this.setData({
        historyStack: [],
        historyIndex: -1
      });

      // 保存初始状态
      this.saveHistory();

      console.log('画布已重置');
    }
  }
});
