// components/mask-canvas/mask-canvas.js

// 三种修复模式配置（移植自 ImageWatermarkRemover.tsx）
const REPAIR_MODE_CONFIGS = {
  standard: {
    maskExpansion: 1.15,
    neighborRadius: 1,
    passFactor: 1.8,
    minPasses: 20,
    fallbackRadiusFactor: 2.8,
    smoothPasses: 1,
    smoothBlend: 0.35,
  },
  fine: {
    maskExpansion: 1.28,
    neighborRadius: 2,
    passFactor: 2.4,
    minPasses: 28,
    fallbackRadiusFactor: 4,
    smoothPasses: 2,
    smoothBlend: 0.42,
  },
  large: {
    maskExpansion: 1.45,
    neighborRadius: 2,
    passFactor: 3.2,
    minPasses: 36,
    fallbackRadiusFactor: 5.5,
    smoothPasses: 3,
    smoothBlend: 0.5,
  },
};

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
      query.select('#mask-layer').fields({ node: true, size: true, rect: true }).exec((res) => {
        if (!res[0]) {
          console.error('canvas 未找到');
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        this._canvasLeft = res[0].left || 0;
        this._canvasTop = res[0].top || 0;
        this._canvasDisplayWidth = res[0].width || width;
        this._canvasDisplayHeight = res[0].height || height;

        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = this.properties.brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.properties.brushColor;

        // 存到实例变量，避免绘制时走 setData
        this._canvas = canvas;
        this._ctx = ctx;
        this._historyStack = [];
        this._historyIndex = -1;
        this._isDrawing = false;
        this.setData({ canvas, ctx, historyIndex: -1 });

        // 保存初始状态
        this.saveHistory();

        // 通知父组件就绪
        this.triggerEvent('ready', { canvas, ctx });
        console.log('画布初始化完成, 位置:', this._canvasLeft, this._canvasTop);
      });
    },

    // 获取触摸坐标（相对于 canvas）
    getPosition(e) {
      const touch = e.touches[0];
      const { width, height } = this.properties;
      const displayW = this._canvasDisplayWidth || width;
      const displayH = this._canvasDisplayHeight || height;
      const left = this._canvasLeft || 0;
      const top = this._canvasTop || 0;
      const scaleX = width / displayW;
      const scaleY = height / displayH;
      return {
        x: (touch.clientX - left) * scaleX,
        y: (touch.clientY - top) * scaleY
      };
    },

    onTouchStart(e) {
      if (this.properties.disabled || !this._ctx) {
        console.log('触摸被禁用或 ctx 不存在');
        return;
      }

      const { x, y } = this.getPosition(e);

      this._isDrawing = true;
      this._lastX = x;
      this._lastY = y;
      this.triggerEvent('drawing', { isDrawing: true });

      const ctx = this._ctx;
      ctx.beginPath();
      ctx.arc(x, y, this.properties.brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = this.properties.brushColor;
      ctx.fill();

      this.triggerEvent('change', { hasDrawing: true });
    },

    onTouchMove(e) {
      if (!this._isDrawing || this.properties.disabled || !this._ctx) {
        return;
      }

      const { x, y } = this.getPosition(e);

      const ctx = this._ctx;
      ctx.beginPath();
      ctx.strokeStyle = this.properties.brushColor;
      ctx.lineWidth = this.properties.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(this._lastX, this._lastY);
      ctx.lineTo(x, y);
      ctx.stroke();

      this._lastX = x;
      this._lastY = y;
    },

    onTouchEnd() {
      if (!this._isDrawing) return;

      this._isDrawing = false;
      this.triggerEvent('drawing', { isDrawing: false });
      this.saveHistory();
      this.triggerEvent('drawend');
    },

    onTouchCancel() {
      this._isDrawing = false;
      this.triggerEvent('drawing', { isDrawing: false });
    },

    // 保存历史记录（存实例变量，不走 setData）
    saveHistory() {
      if (!this._canvas) return;
      const { width, height } = this.properties;
      const imageData = this._ctx.getImageData(0, 0, width, height);

      if (!this._historyStack) this._historyStack = [];
      const stack = this._historyStack.slice(0, this._historyIndex + 1);
      stack.push(imageData);
      if (stack.length > 10) stack.shift();

      this._historyStack = stack;
      this._historyIndex = stack.length - 1;
      // 同步 index 到 data（仅用于 hasDrawing 判断，开销很小）
      this.setData({ historyIndex: this._historyIndex });
    },

    // 撤销
    undo() {
      if (this._historyIndex > 0) {
        this._historyIndex--;
        this._ctx.putImageData(this._historyStack[this._historyIndex], 0, 0);
        this.setData({ historyIndex: this._historyIndex });
        return true;
      }
      return false;
    },

    // 清空
    clear() {
      if (!this._ctx) return;
      this._ctx.clearRect(0, 0, this.properties.width, this.properties.height);
      this.saveHistory();
      this.triggerEvent('change', { hasDrawing: false });
    },

    // 获取画布数据（兼容旧接口名）
    getMaskData() {
      if (!this._canvas) return null;
      return this._ctx.getImageData(0, 0, this.properties.width, this.properties.height);
    },

    // 获取画布数据（新接口名）
    getImageData() {
      if (!this._canvas) return null;
      return this._ctx.getImageData(0, 0, this.properties.width, this.properties.height);
    },

    // 计算涂抹区域的 bounding box（归一化到 0~1）
    getMaskBounds() {
      if (!this._canvas) return null;
      const { width, height } = this.properties;
      const imageData = this._ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      let minX = width, minY = height, maxX = 0, maxY = 0;
      let hasPixel = false;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha > 10) {
            hasPixel = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!hasPixel) return null;
      return {
        left: minX / width,
        top: minY / height,
        right: maxX / width,
        bottom: maxY / height
      };
    },

    // 检查是否有涂抹内容
    hasDrawing() {
      return this._historyIndex > 0;
    },

    /**
     * 本地修复算法（移植自 ImageWatermarkRemover.tsx）
     * @param {string} imagePath  原图路径
     * @param {string} mode       修复模式：standard / fine / large
     * @param {object} offscreenCanvas  离屏 canvas 节点（type=2d）
     * @returns {Promise<string>}  修复后图片的临时路径
     */
    repairImage(imagePath, mode, offscreenCanvas) {
      return new Promise((resolve, reject) => {
        if (!this._canvas || !this._ctx) {
          return reject(new Error('mask canvas 未初始化'));
        }

        const modeConfig = REPAIR_MODE_CONFIGS[mode] || REPAIR_MODE_CONFIGS.fine;
        const { width, height } = this.properties;
        const maskCtx = this._ctx;

        // 1. 获取涂抹 mask 的像素数据
        const maskImageData = maskCtx.getImageData(0, 0, width, height);
        const maskData = maskImageData.data;

        // 2. 把原图画到离屏 canvas，再读取像素
        const offCtx = offscreenCanvas.getContext('2d');
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;

        // 创建 Image 对象并绘制原图
        const img = offscreenCanvas.createImage
          ? offscreenCanvas.createImage()   // wx canvas API
          : new Image();

        img.onload = () => {
          try {
            offCtx.clearRect(0, 0, width, height);
            offCtx.drawImage(img, 0, 0, width, height);

            const imageData = offCtx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // 3. 构建 pendingMask（需要修复的像素）
            const pixelCount = width * height;
            const pendingMask = new Uint8Array(pixelCount);
            const originalMask = new Uint8Array(pixelCount);

            // mask 中有红色涂抹痕迹的像素 → 需要修复
            // maskExpansion 通过直接判断 alpha > 0 实现扩展效果
            for (let i = 0; i < pixelCount; i++) {
              const alpha = maskData[i * 4 + 3];
              if (alpha > 10) {
                pendingMask[i] = 1;
                originalMask[i] = 1;
              }
            }

            // 4. 多次迭代扩散填充
            const maxRadius = (this.properties.brushSize / 2) * modeConfig.maskExpansion;
            const passBudget = Math.max(
              Math.round(maxRadius * modeConfig.passFactor),
              modeConfig.minPasses
            );
            const nextPass = new Uint8ClampedArray(data.length);
            const resolvedIndexes = [];
            const neighborRadius = modeConfig.neighborRadius;

            for (let pass = 0; pass < passBudget; pass++) {
              resolvedIndexes.length = 0;
              nextPass.set(data);

              for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                  const pixelIndex = y * width + x;
                  if (pendingMask[pixelIndex] === 0) continue;

                  let sumR = 0, sumG = 0, sumB = 0, weightTotal = 0;

                  for (let dy = -neighborRadius; dy <= neighborRadius; dy++) {
                    for (let dx = -neighborRadius; dx <= neighborRadius; dx++) {
                      if (dx === 0 && dy === 0) continue;
                      const nx = x + dx, ny = y + dy;
                      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                      const neighborIndex = ny * width + nx;
                      if (pendingMask[neighborIndex] === 1) continue;
                      const rgbaIndex = neighborIndex * 4;
                      const distance = Math.sqrt(dx * dx + dy * dy);
                      const weight = distance === 0 ? 1 : 1 / distance;
                      sumR += data[rgbaIndex] * weight;
                      sumG += data[rgbaIndex + 1] * weight;
                      sumB += data[rgbaIndex + 2] * weight;
                      weightTotal += weight;
                    }
                  }

                  if (weightTotal > 0) {
                    const rgbaIndex = pixelIndex * 4;
                    nextPass[rgbaIndex] = Math.round(sumR / weightTotal);
                    nextPass[rgbaIndex + 1] = Math.round(sumG / weightTotal);
                    nextPass[rgbaIndex + 2] = Math.round(sumB / weightTotal);
                    resolvedIndexes.push(pixelIndex);
                  }
                }
              }

              if (resolvedIndexes.length === 0) break;
              data.set(nextPass);
              for (let i = 0; i < resolvedIndexes.length; i++) {
                pendingMask[resolvedIndexes[i]] = 0;
              }
            }

            // 5. 兜底：用更大半径填充仍未解决的像素
            const fallbackRadius = Math.max(
              Math.round(maxRadius * modeConfig.fallbackRadiusFactor),
              18
            );
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const pixelIndex = y * width + x;
                if (pendingMask[pixelIndex] === 0) continue;
                let sumR = 0, sumG = 0, sumB = 0, weightTotal = 0;
                for (let dy = -fallbackRadius; dy <= fallbackRadius; dy++) {
                  for (let dx = -fallbackRadius; dx <= fallbackRadius; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    const neighborIndex = ny * width + nx;
                    if (pendingMask[neighborIndex] === 1) continue;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance === 0 || distance > fallbackRadius) continue;
                    const rgbaIndex = neighborIndex * 4;
                    const weight = 1 / distance;
                    sumR += data[rgbaIndex] * weight;
                    sumG += data[rgbaIndex + 1] * weight;
                    sumB += data[rgbaIndex + 2] * weight;
                    weightTotal += weight;
                  }
                }
                if (weightTotal > 0) {
                  const rgbaIndex = pixelIndex * 4;
                  data[rgbaIndex] = Math.round(sumR / weightTotal);
                  data[rgbaIndex + 1] = Math.round(sumG / weightTotal);
                  data[rgbaIndex + 2] = Math.round(sumB / weightTotal);
                }
              }
            }

            // 6. 平滑过渡，消除边缘接缝
            for (let smoothPass = 0; smoothPass < modeConfig.smoothPasses; smoothPass++) {
              nextPass.set(data);
              for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                  const pixelIndex = y * width + x;
                  if (originalMask[pixelIndex] === 0) continue;
                  let sumR = 0, sumG = 0, sumB = 0, count = 0;
                  for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                      const neighborIndex = (y + dy) * width + (x + dx);
                      const rgbaIndex = neighborIndex * 4;
                      sumR += data[rgbaIndex];
                      sumG += data[rgbaIndex + 1];
                      sumB += data[rgbaIndex + 2];
                      count++;
                    }
                  }
                  const rgbaIndex = pixelIndex * 4;
                  const blend = modeConfig.smoothBlend;
                  nextPass[rgbaIndex] = Math.round(data[rgbaIndex] * (1 - blend) + (sumR / count) * blend);
                  nextPass[rgbaIndex + 1] = Math.round(data[rgbaIndex + 1] * (1 - blend) + (sumG / count) * blend);
                  nextPass[rgbaIndex + 2] = Math.round(data[rgbaIndex + 2] * (1 - blend) + (sumB / count) * blend);
                }
              }
              data.set(nextPass);
            }

            // 7. 写回离屏 canvas 并导出图片
            offCtx.putImageData(imageData, 0, 0);

            // 导出为临时文件
            wx.canvasToTempFilePath({
              canvas: offscreenCanvas,
              fileType: 'jpg',
              quality: 0.95,
              success: (res) => resolve(res.tempFilePath),
              fail: (err) => reject(new Error('导出图片失败: ' + err.errMsg)),
            });

          } catch (err) {
            reject(err);
          }
        };

        img.onerror = () => reject(new Error('原图加载失败'));
        img.src = imagePath;
      });
    },

    /**
     * 全图去半透明平铺水印（双重检测：偏亮 + 饱和度损失）
     *
     * 原理：
     *   半透明水印（白色文字 + 灰色菱形线条）叠加到底图后：
     *   - 白色文字区域：像素变亮 → 与局部均值相比亮度偏高
     *   - 灰色线条区域：像素向灰色偏移 → 饱和度降低（R/G/B 差值缩小）
     *
     *   步骤：
     *   1. 大核均值模糊原图 → 底图低频估算 L
     *   2. 小核均值模糊原图 → 局部均值 S
     *   3. 检测水印像素：满足以下任一条件
     *      a. 亮度 > L亮度 + brightThreshold（偏亮，白色水印文字）
     *      b. 原图饱和度 < L饱和度 - satLoss（饱和度损失，灰色线条）
     *   4. 对水印像素做膨胀（dilate），确保线条完整覆盖
     *   5. 仅对水印像素用周边非水印像素加权插值还原
     *
     * @param {string} imagePath
     * @param {object} offscreenCanvas
     * @param {object} options
     *   detectKernel:    大核半径，默认 10
     *   brightThreshold: 亮度偏亮阈值，默认 12
     *   satLoss:         饱和度损失阈值，默认 10
     *   dilateRadius:    mask 膨胀半径，默认 2（让线条边缘也被覆盖）
     *   fillRadius:      插值修复邻域半径，默认 6
     * @returns {Promise<string>}
     */
    removeOverlayWatermark(imagePath, offscreenCanvas, options) {
      options = options || {};
      var detectKernel    = options.detectKernel    !== undefined ? options.detectKernel    : 60;
      var brightThreshold = options.brightThreshold !== undefined ? options.brightThreshold : 20;
      var satLoss         = options.satLoss         !== undefined ? options.satLoss         : 18;
      var dilateRadius    = options.dilateRadius    !== undefined ? options.dilateRadius    : 2;
      var fillRadius      = options.fillRadius      !== undefined ? options.fillRadius      : 8;

      return new Promise((resolve, reject) => {
        var offCtx = offscreenCanvas.getContext('2d');
        var img = offscreenCanvas.createImage ? offscreenCanvas.createImage() : new Image();

        img.onload = () => {
          try {
            var width = img.width;
            var height = img.height;
            offscreenCanvas.width = width;
            offscreenCanvas.height = height;
            offCtx.clearRect(0, 0, width, height);
            offCtx.drawImage(img, 0, 0, width, height);

            var imageData = offCtx.getImageData(0, 0, width, height);
            var src = imageData.data;
            var pixelCount = width * height;

            // ---- Step 1: 大核均值模糊估算背景（水平 + 垂直两次滑动窗口）----
            // 核半径 = detectKernel，大核让水印细节被平均掉，剩下低频背景
            var bk = Math.min(detectKernel, Math.floor(Math.min(width, height) / 2) - 1);
            var tmpRGB  = new Float32Array(pixelCount * 3);
            var blurRGB = new Float32Array(pixelCount * 3);

            // 水平方向滑动窗口
            for (var y = 0; y < height; y++) {
              for (var c = 0; c < 3; c++) {
                var sm = 0, ct = 0;
                for (var x = 0; x <= Math.min(bk, width - 1); x++) { sm += src[(y * width + x) * 4 + c]; ct++; }
                for (var x = 0; x < width; x++) {
                  tmpRGB[(y * width + x) * 3 + c] = sm / ct;
                  if (x + bk + 1 < width) { sm += src[(y * width + x + bk + 1) * 4 + c]; ct++; }
                  if (x - bk >= 0)        { sm -= src[(y * width + x - bk)     * 4 + c]; ct--; }
                }
              }
            }
            // 垂直方向滑动窗口
            for (var x = 0; x < width; x++) {
              for (var c = 0; c < 3; c++) {
                var sm = 0, ct = 0;
                for (var y = 0; y <= Math.min(bk, height - 1); y++) { sm += tmpRGB[(y * width + x) * 3 + c]; ct++; }
                for (var y = 0; y < height; y++) {
                  blurRGB[(y * width + x) * 3 + c] = sm / ct;
                  if (y + bk + 1 < height) { sm += tmpRGB[((y + bk + 1) * width + x) * 3 + c]; ct++; }
                  if (y - bk >= 0)         { sm -= tmpRGB[((y - bk)     * width + x) * 3 + c]; ct--; }
                }
              }
            }

            // ---- Step 2: 检测水印像素 ----
            var watermarkMask = new Uint8Array(pixelCount);
            var watermarkCount = 0;
            for (var i = 0; i < pixelCount; i++) {
              var ri = i * 4, bi = i * 3;
              var sR = src[ri], sG = src[ri + 1], sB = src[ri + 2];
              var lR = blurRGB[bi], lG = blurRGB[bi + 1], lB = blurRGB[bi + 2];
              var srcL   = (sR + sG + sB) / 3;
              var blurL  = (lR + lG + lB) / 3;
              var srcSat  = Math.max(sR, sG, sB) - Math.min(sR, sG, sB);
              var blurSat = Math.max(lR, lG, lB) - Math.min(lR, lG, lB);
              // 白色水印（心形/文字）：比背景亮，且与背景亮度差足够大
              var isBright = (srcL - blurL) > brightThreshold;
              // 灰色线条：饱和度比背景低，且像素本身不太亮（排除浅色衣物）
              var isFaded  = (blurSat - srcSat) > satLoss && blurSat > 25 && srcL < 200 && srcSat < 30;
              // 保护有色像素：饱和度 > 25 且非极亮白色（排除皮肤/衣物/头发）
              var isVivid  = srcSat > 25 && srcL < 245;
              // 额外保护：如果背景本身就很亮（blurL > 200），说明这不是叠加水印而是正常高亮内容
              var isBgBright = blurL > 200;
              if ((isBright || isFaded) && !isVivid && !isBgBright) {
                watermarkMask[i] = 1;
                watermarkCount++;
              }
            }

            // 安全阀：检测比例超过 40% 时收紧阈值重跑
            if (watermarkCount > pixelCount * 0.40) {
              watermarkCount = 0;
              for (var i = 0; i < pixelCount; i++) {
                watermarkMask[i] = 0;
                var ri = i * 4, bi = i * 3;
                var sR = src[ri], sG = src[ri + 1], sB = src[ri + 2];
                var lR = blurRGB[bi], lG = blurRGB[bi + 1], lB = blurRGB[bi + 2];
                var srcL   = (sR + sG + sB) / 3;
                var blurL  = (lR + lG + lB) / 3;
                var srcSat  = Math.max(sR, sG, sB) - Math.min(sR, sG, sB);
                var blurSat = Math.max(lR, lG, lB) - Math.min(lR, lG, lB);
                var isVivid2 = srcSat > 25 && srcL < 245;
                var isBgBright2 = blurL > 200;
                if (!isVivid2 && !isBgBright2 && (
                    ((srcL - blurL) > brightThreshold * 1.8) ||
                    ((blurSat - srcSat) > satLoss * 1.8 && blurSat > 35 && srcSat < 25 && srcL < 200))) {
                  watermarkMask[i] = 1;
                  watermarkCount++;
                }
              }
            }

            console.log('水印像素数:', watermarkCount, '占比:', (watermarkCount / pixelCount * 100).toFixed(1) + '%');

            // ---- Step 3: mask 膨胀 ----
            if (dilateRadius > 0) {
              var dilated = new Uint8Array(pixelCount);
              for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                  if (watermarkMask[y * width + x] === 0) continue;
                  for (var dy = -dilateRadius; dy <= dilateRadius; dy++) {
                    for (var dx = -dilateRadius; dx <= dilateRadius; dx++) {
                      var nx = x + dx, ny = y + dy;
                      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        dilated[ny * width + nx] = 1;
                      }
                    }
                  }
                }
              }
              for (var i = 0; i < pixelCount; i++) watermarkMask[i] = dilated[i];
            }

            // ---- Step 4: 加权插值修复 ----
            var result = new Uint8ClampedArray(src);
            for (var y = 0; y < height; y++) {
              for (var x = 0; x < width; x++) {
                var idx = y * width + x;
                if (watermarkMask[idx] === 0) continue;
                var sumR = 0, sumG = 0, sumB = 0, wTotal = 0;
                for (var dy = -fillRadius; dy <= fillRadius; dy++) {
                  for (var dx = -fillRadius; dx <= fillRadius; dx++) {
                    var nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    var nIdx = ny * width + nx;
                    if (watermarkMask[nIdx] === 1) continue;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > fillRadius) continue;
                    var w = dist < 0.5 ? 4 : 1 / dist;
                    var nri = nIdx * 4;
                    sumR += src[nri]     * w;
                    sumG += src[nri + 1] * w;
                    sumB += src[nri + 2] * w;
                    wTotal += w;
                  }
                }
                var ri = idx * 4;
                if (wTotal > 0) {
                  result[ri]     = Math.round(sumR / wTotal);
                  result[ri + 1] = Math.round(sumG / wTotal);
                  result[ri + 2] = Math.round(sumB / wTotal);
                } else {
                  var bi = idx * 3;
                  result[ri]     = Math.round(blurRGB[bi]);
                  result[ri + 1] = Math.round(blurRGB[bi + 1]);
                  result[ri + 2] = Math.round(blurRGB[bi + 2]);
                }
              }
            }

            // ---- Step 5: 写回并导出 ----
            var outData = offCtx.createImageData(width, height);
            outData.data.set(result);
            offCtx.putImageData(outData, 0, 0);

            wx.canvasToTempFilePath({
              canvas: offscreenCanvas,
              fileType: 'jpg',
              quality: 0.95,
              success: (res) => resolve(res.tempFilePath),
              fail: (err) => reject(new Error('导出图片失败: ' + err.errMsg)),
            });

          } catch (err) {
            reject(err);
          }
        };

        img.onerror = () => reject(new Error('原图加载失败'));
        img.src = imagePath;
      });
    },

    // 重置画布（切换图片时调用）
    reset() {
      if (!this._ctx) return;
      this._ctx.clearRect(0, 0, this.properties.width, this.properties.height);
      this._historyStack = [];
      this._historyIndex = -1;
      this._isDrawing = false;
      this.saveHistory();
    }
  }
});
