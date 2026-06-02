import axios from 'axios';
import logger from '../utils/logger.js';

const BASE = 'https://graph.facebook.com/v19.0';

class InstagramAPI {
  constructor() {
    this.accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    this.token = process.env.INSTAGRAM_ACCESS_TOKEN;
  }

  isConfigured() {
    return Boolean(this.accountId && this.token);
  }

  async getProfile() {
    if (!this.isConfigured()) {
      logger.warn('Instagram no configurado: falta ACCOUNT_ID o ACCESS_TOKEN');
      return null;
    }

    const { data } = await axios.get(`${BASE}/${this.accountId}`, {
      params: {
        fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url',
        access_token: this.token,
      },
    });

    logger.info(`Instagram: perfil ${data.username || data.name} sincronizado`);
    return data;
  }

  async getInsights() {
    if (!this.isConfigured()) {
      logger.warn('Instagram no configurado: falta ACCOUNT_ID o ACCESS_TOKEN');
      return null;
    }

    const { data } = await axios.get(`${BASE}/${this.accountId}/insights`, {
      params: {
        metric: 'impressions,reach,profile_views',
        period: 'day',
        access_token: this.token,
      },
    });

    return data;
  }

  async getMedia(limit = 10) {
    if (!this.isConfigured()) {
      logger.warn('Instagram no configurado: falta ACCOUNT_ID o ACCESS_TOKEN');
      return [];
    }

    const { data } = await axios.get(`${BASE}/${this.accountId}/media`, {
      params: {
        fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
        limit,
        access_token: this.token,
      },
    });

    return data.data || [];
  }
}

export default new InstagramAPI();