const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 平台解析器
const parsers = {
  // 抖音解析
  async douyin(url) {
    // 提取视频ID
    const matches = url.match(/video\/(\d+)/) || url.match(/v\.douyin\.com\/(\w+)/);
    if (!matches) throw new Error('无效的抖音链接');
    
    // 实际需要逆向抖音API或使用第三方服务
    // 这里给出示例结构
    const response = await axios.get('https://api.example.com/parse/douyin', {
      params: { url }
    });
    
    return {
      videoUrl: response.data.video_url,
      cover: response.data.cover,
      title: response.data.title,
      author: response.data.author
    };
  },

  // 快手解析
  async kuaishou(url) {
    const response = await axios.get('https://api.example.com/parse/kuaishou', {
      params: { url }
    });
    return response.data;
  },

  // 小红书解析
  async xiaohongshu(url) {
    const response = await axios.get('https://api.example.com/parse/xhs', {
      params: { url }
    });
    return response.data;
  }
};

exports.main = async (event, context) => {
  const { url } = event;
  
  // 检测平台
  let platform = null;
  if (/douyin|iesdouyin/.test(url)) platform = 'douyin';
  else if (/kuaishou|chenzhongtech/.test(url)) platform = 'kuaishou';
  else if (/xiaohongshu|xhslink/.test(url)) platform = 'xiaohongshu';
  
  if (!platform) {
    return { code: -1, msg: '不支持该平台' };
  }
  
  try {
    const result = await parsers[platform](url);
    return { 
      code: 0, 
      data: {
        ...result,
        url,
        platform
      }
    };
  } catch (err) {
    console.error('解析失败:', err);
    return { code: -1, msg: '解析失败，请检查链接' };
  }
};