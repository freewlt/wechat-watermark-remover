const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 发起 HTTP 请求，自动跟随重定向（最多10次）
 */
function request(url, options, redirectCount) {
  options = options || {}
  redirectCount = redirectCount || 0
  return new Promise(function(resolve, reject) {
    if (redirectCount > 10) return reject(new Error('重定向次数过多'))

    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, {
      headers: Object.assign({
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        'Referer': 'https://www.douyin.com/'
      }, options.headers || {}),
      timeout: 15000
    }, function(res) {
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) !== -1) {
        const location = res.headers['location']
        if (!location) return reject(new Error('重定向无目标地址'))
        let nextUrl = location
        if (location.startsWith('/')) {
          const idx = url.indexOf('/', url.indexOf('//') + 2)
          const base = idx !== -1 ? url.slice(0, idx) : url
          nextUrl = base + location
        }
        res.resume()
        return resolve(request(nextUrl, options, redirectCount + 1))
      }
      let data = ''
      res.on('data', function(chunk) { data += chunk })
      res.on('end', function() {
        resolve({ statusCode: res.statusCode, body: data, headers: res.headers, finalUrl: url })
      })
    })
    req.on('error', reject)
    req.on('timeout', function() { req.destroy(); reject(new Error('请求超时')) })
  })
}

/**
 * 从 URL 中提取抖音 video_id
 */
function extractDouyinVideoId(url) {
  const match = url.match(/\/video\/(\d+)/)
  if (match) return match[1]
  const modalMatch = url.match(/modal_id=(\d+)/)
  if (modalMatch) return modalMatch[1]
  return null
}

/**
 * 解析抖音视频
 */
async function parseDouyin(url) {
  console.log('开始解析抖音:', url)

  const expanded = await request(url)
  const finalUrl = expanded.finalUrl
  console.log('最终 URL:', finalUrl)

  let videoId = extractDouyinVideoId(finalUrl)
  if (!videoId) videoId = extractDouyinVideoId(url)
  if (!videoId) throw new Error('无法识别抖音视频ID，请确认链接有效')

  console.log('video_id:', videoId)

  const apiUrl = 'https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=' + videoId
  const res = await request(apiUrl)
  console.log('API 响应状态:', res.statusCode)

  let data
  try {
    data = JSON.parse(res.body)
  } catch (e) {
    throw new Error('抖音 API 响应解析失败')
  }

  const item = data.item_list && data.item_list[0]
  if (!item) throw new Error('未获取到视频信息，接口可能已更新')

  const videoUrlRaw = (item.video && item.video.play_addr && item.video.play_addr.url_list && item.video.play_addr.url_list[0]) || ''
  const videoUrl = videoUrlRaw.replace('playwm', 'play')
  const cover = (item.video && item.video.cover && item.video.cover.url_list && item.video.cover.url_list[0]) || ''

  return {
    platform: '抖音',
    title: item.desc || '抖音视频',
    cover: cover,
    videoUrl: videoUrl,
    author: (item.author && item.author.nickname) || '',
    url: url
  }
}

/**
 * 解析微博视频
 */
async function parseWeibo(url) {
  const res = await request(url, { headers: { 'Referer': 'https://weibo.com/' } })

  const mp4Match = res.body.match(/"url":"(https?:[^"]+\.mp4[^"]*)"/)
  if (!mp4Match) throw new Error('未找到微博视频地址')

  const videoUrl = mp4Match[1].replace(/\\u002F/g, '/').replace(/\\/g, '')
  const titleMatch = res.body.match(/<title[^>]*>([^<]+)<\/title>/)
  const title = titleMatch ? titleMatch[1].replace(' - 微博', '').trim() : '微博视频'

  return {
    platform: '微博',
    title: title,
    cover: '',
    videoUrl: videoUrl,
    author: '',
    url: url
  }
}

/**
 * 判断平台并路由解析
 */
async function parseVideo(url) {
  if (url.indexOf('douyin.com') !== -1 || url.indexOf('iesdouyin.com') !== -1) {
    return await parseDouyin(url)
  } else if (url.indexOf('weibo.com') !== -1 || url.indexOf('weibo.cn') !== -1 || url.indexOf('t.cn') !== -1) {
    return await parseWeibo(url)
  } else {
    throw new Error('暂不支持该平台，目前支持抖音、微博')
  }
}

exports.main = async function(event) {
  const url = event.url
  if (!url) return { code: -1, msg: '缺少 url 参数' }

  try {
    const data = await parseVideo(url.trim())
    return { code: 0, data: data }
  } catch (err) {
    console.error('解析失败:', err)
    return { code: -1, msg: err.message || '解析失败' }
  }
}
