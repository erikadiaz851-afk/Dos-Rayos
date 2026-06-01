import axios from 'axios';
import logger from '../utils/logger.js';

const BASE = 'https://api.twitter.com/2';

class TwitterAPI {
  get headers() {
    return { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}` };
  }

  async getUserByUsername(username) {
    const { data } = await axios.get(`${BASE}/users/by/username/${username}`, {
      headers: this.headers,
      params: { 'user.fields': 'id,name,username,description,public_metrics,profile_image_url,created_at' },
    });
    const u = data.data;
    logger.info(`Twitter: @${u?.username} (${u?.public_metrics?.followers_count} seguidores)`);
    return u;
  }

  async getTweets(userId, max = 20) {
    const { data } = await axios.get(`${BASE}/users/${userId}/tweets`, {
      headers: this.headers,
      params: {
        max_results: Math.min(max, 100),
        'tweet.fields': 'created_at,public_metrics',
        exclude: 'retweets,replies',
      },
    });
    return data.data || [];
  }

  normalize(user, tweets) {
    const m = user?.public_metrics || {};
    const n = tweets.length || 1;
    const totals = tweets.reduce((acc, t) => {
      acc.likes   += t.public_metrics?.like_count    || 0;
      acc.replies += t.public_metrics?.reply_count   || 0;
      acc.rts     += t.public_metrics?.retweet_count || 0;
      return acc;
    }, { likes: 0, replies: 0, rts: 0 });
    return {
      platform:     'twitter',
      followers:    m.followers_count || 0,
      following:    m.following_count || 0,
      posts_count:  m.tweet_count     || 0,
      avg_likes:    totals.likes   / n,
      avg_comments: totals.replies / n,
      raw_data:     { user, totals },
    };
  }
}

export default new TwitterAPI();
