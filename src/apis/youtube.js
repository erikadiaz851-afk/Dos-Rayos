import axios from 'axios';
import logger from '../utils/logger.js';

const YT   = 'https://www.googleapis.com/youtube/v3';
const GOOG = 'https://oauth2.googleapis.com/token';

class YouTubeAPI {
  constructor() {
    this.clientId     = process.env.YOUTUBE_CLIENT_ID;
    this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    this.refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
    this.channelId    = process.env.YOUTUBE_CHANNEL_ID;
    this._token  = null;
    this._expiry = 0;
  }

  async _ensureToken() {
    if (this._token && this._expiry > Date.now()) return;
    const { data } = await axios.post(GOOG, {
      client_id:     this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type:    'refresh_token',
    });
    this._token  = data.access_token;
    this._expiry = Date.now() + (data.expires_in - 60) * 1000;
    logger.debug('YouTube: token renovado');
  }

  async getChannel() {
    await this._ensureToken();
    const { data } = await axios.get(`${YT}/channels`, {
      params: { part: 'snippet,statistics', id: this.channelId, access_token: this._token },
    });
    const ch = data.items?.[0];
    logger.info(`YouTube: canal "${ch?.snippet?.title}" (${ch?.statistics?.subscriberCount} subs)`);
    return ch;
  }

  async getVideos(max = 20) {
    await this._ensureToken();
    const { data: search } = await axios.get(`${YT}/search`, {
      params: {
        part: 'snippet', channelId: this.channelId,
        order: 'date', maxResults: max, type: 'video',
        access_token: this._token,
      },
    });
    const ids = search.items.map(i => i.id.videoId).join(',');
    const { data: vids } = await axios.get(`${YT}/videos`, {
      params: { part: 'snippet,statistics,contentDetails', id: ids, access_token: this._token },
    });
    logger.info(`YouTube: ${vids.items.length} videos`);
    return vids.items;
  }

  async getComments(videoId, max = 20) {
    await this._ensureToken();
    try {
      const { data } = await axios.get(`${YT}/commentThreads`, {
        params: { part: 'snippet', videoId, maxResults: max, order: 'relevance', access_token: this._token },
      });
      return (data.items || []).map(i => ({
        ...i.snippet.topLevelComment.snippet,
        comment_id: i.id,
      }));
    } catch { return []; }
  }

  normalize(channel, videos) {
    const stats = channel?.statistics || {};
    const n     = videos.length || 1;
    const totals = videos.reduce((acc, v) => {
      acc.views    += parseInt(v.statistics?.viewCount || 0);
      acc.likes    += parseInt(v.statistics?.likeCount || 0);
      acc.comments += parseInt(v.statistics?.commentCount || 0);
      return acc;
    }, { views: 0, likes: 0, comments: 0 });
    return {
      platform:     'youtube',
      followers:    parseInt(stats.subscriberCount || 0),
      posts_count:  parseInt(stats.videoCount || 0),
      avg_views:    totals.views / n,
      avg_likes:    totals.likes / n,
      avg_comments: totals.comments / n,
      raw_data:     { channel: channel?.snippet, statistics: stats },
    };
  }
}

export default new YouTubeAPI();
