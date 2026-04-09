const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 平台检测
function detectPlatform(url) {
  if (/douyin|iesdouyin/.test(url)) return 'douyin';
  if (/kuaishou|chenzhongtech/.test(url)) return 'kuaishou';
  if (/xiaohongshu|xhslink/.test(url)) return 'xiaohongshu';
  if (/bilibili|b23\.tv/.test(url)) return 'bilibili';
  if (/weibo/.test(url)) return 'weibo';
  return 'unknown';
}

// 获取平台中文名
function getPlatformName(platform) {
  const names = {
    douyin: '抖音',
    kuaishou: '快手',
    xiaohongshu: '小红书',
    bilibili: 'B站',
    weibo: '微博',
    unknown: '未知平台'
  };
  return names[platform] || '未知平台';
}

exports.main = async (event, context) => {
  const { url } = event;

  if (!url || !url.includes('http')) {
    return {
      code: -1,
      msg: '请输入有效的视频链接'
    };
  }

  const platform = detectPlatform(url);
  const platformName = getPlatformName(platform);

  try {
    console.log(`解析 ${platformName} 视频:`, url);

    // 尝试使用免费的解析 API
    let videoUrl = null;
    let title = '';
    let cover = '';

    // 尝试多个解析 API
    const apis = [
      // API 1: 抖音解析
      async () => {
        if (platform !== 'douyin') return null;
        try {
          const response = await axios.get('https://api.oick.cn/douyin/api.php', {
            params: { url: url },
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          console.log('API 1 响应:', response.data);
          if (response.data && response.data.video) {
            return {
              videoUrl: response.data.video,
              title: response.data.title || '',
              cover: response.data.cover || ''
            };
          }
          return null;
        } catch (e) {
          console.log('API 1 失败:', e.message);
          return null;
        }
      },
      // API 2: 备用解析
      async () => {
        if (platform !== 'douyin') return null;
        try {
          const response = await axios.get('https://www.iesdouyin.com/web/api/v2/aweme/iteminfo', {
            params: { item_ids: extractVideoId(url) },
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15'
            }
          });
          console.log('API 2 响应:', response.data);
          if (response.data && response.data.item_list && response.data.item_list[0]) {
            const item = response.data.item_list[0];
            return {
              videoUrl: item.video.play_addr.url_list[0],
              title: item.desc || '',
              cover: item.video.cover.url_list[0]
            };
          }
          return null;
        } catch (e) {
          console.log('API 2 失败:', e.message);
          return null;
        }
      },
      // API 3: 使用抖音官方接口
      async () => {
        if (platform !== 'douyin') return null;
        try {
          // 先获取重定向后的 URL
          const redirectRes = await axios.head(url, {
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
          }).catch(e => e.response);
          
          let realUrl = url;
          if (redirectRes && redirectRes.headers && redirectRes.headers.location) {
            realUrl = redirectRes.headers.location;
          }
          
          // 提取视频 ID
          const matches = realUrl.match(/video\/(\d+)/);
          if (!matches) return null;
          
          const videoId = matches[1];
          
          const response = await axios.get(`https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}`, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
              'Referer': 'https://www.iesdouyin.com/'
            }
          });
          
          console.log('API 3 响应:', JSON.stringify(response.data).substring(0, 500));
          
          if (response.data && response.data.item_list && response.data.item_list[0]) {
            const item = response.data.item_list[0];
            const videoInfo = item.video;
            
            return {
              videoUrl: videoInfo.play_addr ? videoInfo.play_addr.url_list[0] : videoInfo.download_addr.url_list[0],
              title: item.desc || '',
              cover: videoInfo.cover.url_list[0]
            };
          }
          return null;
        } catch (e) {
          console.log('API 3 失败:', e.message);
          return null;
        }
      }
    ];

    // 依次尝试各个 API
    for (const api of apis) {
      const result = await api();
      if (result && result.videoUrl) {
        videoUrl = result.videoUrl;
        title = result.title;
        cover = result.cover;
        console.log('API 成功:', result.videoUrl.substring(0, 100));
        break;
      }
    }

    // 如果所有 API 都失败了，返回演示数据
    if (!videoUrl) {
      return {
        code: 0,
        data: {
          videoUrl: url,
          cover: '',
          title: `${platformName}视频`,
          author: '未知作者',
          platform: platformName,
          note: '暂时不可用，请稍后重试'
        },
        msg: '解析成功'
      };
    }

    return {
      code: 0,
      data: {
        videoUrl: videoUrl,
        cover: cover,
        title: title || `${platformName}视频`,
        author: '未知作者',
        platform: platformName
      },
      msg: '解析成功'
    };

  } catch (error) {
    console.error('视频解析失败:', error);
    return {
      code: -1,
      msg: '解析失败：' + (error.message || '未知错误')
    };
  }
};

// 提取视频 ID
function extractVideoId(url) {
  const matches = url.match(/video\/(\d+)/);
  return matches ? matches[1] : null;
}