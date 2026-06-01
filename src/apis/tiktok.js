import axios from 'axios';
import logger from '../utils/logger.js';

const BASE = 'https://open.tiktokapis.com/v2';

class TikTokAPI {
  constructor() {
    this.clientKey    = process.env.TIKTOK_CLIENT_KEY;
    this.clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    this.accessToken  = process.env.TIKTOK_ACCESS_TOKEN;
  }

  get headers() {
    return { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };
  }

  async getUserInfo() {
    const { data } = await axios.get(`${BASE}/user/info/`, {
      headers: this.headers,
      params: {
        fields: 'open_id,display_name,bio_description,follower_count,following_count,likes_count,video_count,avatar_url',
      },
    });
    const user = data.data?.user;
    logger.info(`TikTok: @${user?.display_name} (${user?.follower_count} seguidores)`);
    return user;
  }

  async getVideos(maxCount = 20) {
    const { data } = await axios.post(
      `${BASE}/video/list/`,
      { max_count: maxCount },
      {
        headers: this.headers,
        params: {
          fields: 'id,title,video_description,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count,duration',
        },
      }
    );
    const videos = data.data?.videos || [];
    logger.info(`TikTok: ${videos.length} videos`);
    return videos;
  }

  normalize(user, videos) {
    const n     = videos.length || 1;
    const views = videos.reduce((s, v) => s + (v.view_count || 0), 0);
    const likes = videos.reduce((s, v) => s + (v.like_count || 0), 0);
    const comms = videos.reduce((s, v) => s + (v.comment_count || 0), 0);
    return {
      platform:    'tiktok',
      followers:   user?.follower_count || 0,
      following:   user?.following_count || 0,
      posts_count: user?.video_count || 0,
      avg_views:   views / n,
      avg_likes:   likes / n,
      avg_comments: comms / n,
      raw_data:    { user, videos: videos.slice(0, 10) },
    };
  }
}

export default new TikTokAPI();
