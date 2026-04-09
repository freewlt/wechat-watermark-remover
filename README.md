# 智能去水印小程序

一款基于微信小程序开发的智能内容处理工具，支持图片去水印和视频解析下载功能。

## 功能特性

### 图片去水印
- 自动识别水印位置（右下角、左下角、右上角、左上角）
- 手动涂抹选择水印区域
- 使用 AI 算法智能修复背景
- 支持预览对比效果
- 一键保存到相册

### 视频解析
- 支持多平台视频解析（抖音、快手、小红书、B站、微博等）
- 无水印视频下载
- 视频封面提取

### 用户系统
- 微信一键登录
- 使用次数统计
- VIP 会员功能（待开发）
- 邀请好友奖励机制

## 技术栈

- **前端**: 微信小程序原生开发
- **云开发**: 微信云开发（云函数 + 云存储）
- **图片处理**: Jimp 库
- **AI 处理**: 百度 AI / 腾讯云图像处理

## 项目结构

```
watermark-remover/
├── miniprogram/              # 小程序前端代码
│   ├── pages/               # 页面
│   │   ├── home/           # 首页
│   │   ├── pic/            # 图片去水印
│   │   ├── video/          # 视频解析
│   │   └── profile/        # 个人中心
│   ├── components/         # 组件
│   │   └── mask-canvas/    # 涂抹画布组件
│   ├── images/             # 图片资源
│   ├── app.js              # 应用入口
│   ├── app.json            # 应用配置
│   └── app.wxss            # 全局样式
├── cloudfunctions/          # 云函数
│   ├── removeWatermark/    # 去水印云函数
│   └── parseVideo/         # 视频解析云函数
└── README.md
```

## 安装与运行

### 环境要求
- 微信开发者工具
- 微信小程序账号
- 开通微信云开发

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/freewlt/wechat-watermark-remover.git
   cd wechat-watermark-remover
   ```

2. **导入项目**
   - 打开微信开发者工具
   - 选择 "导入项目"
   - 选择 `watermark-remover` 文件夹
   - 填写你的小程序 AppID

3. **配置云开发**
   - 在开发者工具中点击 "云开发" 按钮
   - 创建云开发环境
   - 记录环境 ID

4. **部署云函数**
   - 右键 `cloudfunctions/removeWatermark` 文件夹
   - 选择 "创建并部署：云端安装依赖"
   - 右键 `cloudfunctions/parseVideo` 文件夹
   - 选择 "创建并部署：云端安装依赖"

5. **配置 API 密钥（可选）**
   - 如需使用百度 AI 功能，在 `cloudfunctions/removeWatermark/config.js` 中配置 API 密钥

6. **运行项目**
   - 点击开发者工具中的 "编译" 按钮
   - 使用真机调试或预览功能测试

## 使用说明

### 图片去水印
1. 进入 "图片去水印" 页面
2. 从相册选择或拍摄照片
3. 自动识别水印位置，或手动涂抹水印区域
4. 点击 "开始处理"
5. 预览处理结果，满意后保存到相册

### 视频解析
1. 进入 "视频解析" 页面
2. 粘贴视频分享链接
3. 点击 "解析视频"
4. 预览并下载无水印视频

## 配置说明

### 云函数配置

在 `cloudfunctions/removeWatermark/config.js` 中添加以下配置：

```javascript
module.exports = {
  BAIDU_AI: {
    apiKey: 'your-api-key',
    secretKey: 'your-secret-key'
  }
};
```

### 小程序配置

在 `miniprogram/app.json` 中配置你的云开发环境：

```json
{
  "cloud": true,
  "cloudfunctionRoot": "cloudfunctions/"
}
```

## 注意事项

1. **图片尺寸限制**: 为保证性能和兼容性，建议处理尺寸不超过 1920x1920 像素的图片
2. **使用次数**: 免费用户每日有使用次数限制，可通过观看广告或邀请好友获得额外次数
3. **隐私保护**: 用户上传的图片和视频仅用于处理，处理完成后会自动删除
4. **网络要求**: 视频解析功能需要稳定的网络连接

## 常见问题

### Q: 为什么去水印效果不理想？
A: 去水印效果取决于水印的复杂程度和背景内容。对于复杂背景的水印，建议多次尝试或手动选择水印区域。

### Q: 视频解析失败怎么办？
A: 视频解析依赖于第三方 API，可能会因平台更新而失效。请确保使用的是最新版本的小程序。

### Q: 如何处理大尺寸图片？
A: 系统会自动压缩大尺寸图片以保证处理速度和内存占用。如需处理原图，建议使用专业软件。

## 更新日志

### v4.0.0 (2024-01)
- 全新 UI 设计
- 优化图片处理算法
- 新增手动涂抹功能
- 支持更多视频平台

### v3.0.0 (2023-12)
- 添加 VIP 会员功能
- 优化云函数性能
- 修复已知问题

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 作者: freewlt
- 邮箱: your-email@example.com
- GitHub: https://github.com/freewlt

## 致谢

- [微信云开发](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [Jimp](https://github.com/jimp-dev/jimp)
- [百度 AI](https://ai.baidu.com/)

---

**免责声明**: 本工具仅供学习交流使用，请勿用于侵犯他人版权或隐私。使用本工具处理的内容需遵守相关法律法规。
