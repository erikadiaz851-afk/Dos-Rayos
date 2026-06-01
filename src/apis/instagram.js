import axios from 'axios';
import logger from '../utils/logger.js';

const BASE = 'https://graph.instagram.com/v18.0';

class InstagramAPI {
  constructor() {
    this.token     = process.env.META_ACCESS_TOKEN;
    this.accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  }

  async getProfile() {
    const { data } = await axios.get(`${BASE}/${this.accountId}`, {
      params: {
        fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website',
        access_token: this.token,
      },
    });
    logger.info(`Instagram: perfil @${data.username} (${data.followers_count} seguidores)`);
    return data;
  }

  async getInsights() {
    const { data } = await axios.get(`${BASE}/${this.accountId}/insights`, {
      params: {
        metric: 'impressions,reach,profile_views,follower_count',
        period: 'day',
        since: Math.floor(Date.now() / 1000) - 30 * 86400,
        until: Math.floor(Date.now() / 1000),
        access_token: this.token,
      },
    });
    return data.data || [];
  }

  async getRecentMedia(limit = 20) {
    const { data } = await axios.get(`${BASE}/${this.accountId}/media`, {
      params: {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
        limit,
        access_token: this.token,
      },
    });
    const media = data.data || [];
    logger.info(`Instagram: ${media.length} publicaciones obtenidas`);
    return Promise.all(media.map(p => this._postInsights(p)));
  }

  async _postInsights(post) {
    try {
      const metrics = post.media_type === 'VIDEO'
        ? 'impressions,reach,plays,saved'
        : 'impressions,reach,saved,engagement';
      const { data } = await axios.get(`${BASE}/${post.id}/insights`, {
        params: { metric: metrics, access_token: this.token },
      });
      const ins = {};
      (data.data || []).forEach(m => { ins[m.name] = m.values?.[0]?.value || 0; });
      return { ...post, insights: ins };
    } catch {
      return { ...post, insights: {} };
    }
  }

  async getComments(limit = 40) {
    const media = await this.getRecentMedia(5);
    const all   = [];
    for (const post of media) {
      try {
        const { data } = await axios.get(`${BASE}/${post.id}/comments`, {
          params: { fields: 'id,text,username,timestamp,like_count', limit: 10, access_token: this.token },
        });
        (data.data || []).forEach(c => all.push({ ...c, post_id: post.id }));
      } catch { /* post sin comentarios */ }
    }
    logger.info(`Instagram: ${all.length} comentarios`);
    return all;
  }

  normalize(profile, insights) {
    const imp = insights.find(i => i.name === 'impressions');
    const rch = insights.find(i => i.name === 'reach');
    return {
      platform:      'instagram',
      followers:     profile.followers_count,
      following:     profile.follows_count,
      posts_count:   profile.media_count,
      impressions_7d: (imp?.values || []).slice(-7).reduce((s, v) => s + (v.value || 0), 0),
      reach_7d:       (rch?.values || []).slice(-7).reduce((s, v) => s + (v.value || 0), 0),
      raw_data:       { profile, insights },
    };
  }
}

export default new InstagramAPI();
