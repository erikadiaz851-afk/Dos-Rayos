import 'dotenv/config';
import { query } from '../utils/database.js';
import logger from '../utils/logger.js';
import instagramAPI from '../apis/instagram.js';
import tiktokAPI    from '../apis/tiktok.js';
import youtubeAPI   from '../apis/youtube.js';
import spotifyAPI   from '../apis/spotify.js';
import twitterAPI   from '../apis/twitter.js';
import { deezerAPI, appleMusicAPI } from '../apis/music.js';
import ai from './aiAnalysis.js';

// ── Helpers de guardado ──────────────────────────────────────
async function saveMetrics(m) {
  if (!m) return;
  await query(
    `INSERT INTO platform_metrics
       (platform,followers,following,posts_count,avg_likes,avg_comments,avg_views,
        reach_7d,impressions_7d,engagement_rate,raw_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [m.platform, m.followers, m.following, m.posts_count, m.avg_likes,
     m.avg_comments, m.avg_views, m.reach_7d, m.impressions_7d,
     m.engagement_rate, JSON.stringify(m.raw_data)]
  );
  logger.info(`💾 ${m.platform}: métricas guardadas`);
}

async function savePosts(posts, platform) {
  if (!posts?.length) return;
  for (const p of posts) {
    try {
      await query(
        `INSERT INTO posts
           (platform,post_id,post_type,title,description,published_at,
            likes,comments,shares,views,saves,reach,thumbnail_url,post_url,raw_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (post_id) DO UPDATE
           SET likes=$7,comments=$8,shares=$9,views=$10,saves=$11,reach=$12`,
        [
          platform,
          String(p.id || p.post_id || Math.random()),
          p.media_type || p.post_type || 'post',
          p.title || null,
          p.caption || p.video_description || p.description || null,
          p.timestamp ? new Date(p.timestamp) : p.create_time ? new Date(p.create_time * 1000) : null,
          Number(p.like_count  || p.statistics?.likeCount    || p.like_count    || 0),
          Number(p.comments_count || p.statistics?.commentCount || p.comment_count  || 0),
          Number(p.share_count || p.statistics?.shareCount   || 0),
          Number(p.view_count  || p.statistics?.viewCount    || p.plays         || 0),
          Number(p.insights?.saved || 0),
          Number(p.insights?.reach || 0),
          p.thumbnail_url || p.cover_image_url || null,
          p.permalink || p.share_url || null,
          JSON.stringify(p),
        ]
      );
    } catch { /* duplicado — normal */ }
  }
  logger.info(`💾 ${platform}: ${posts.length} posts guardados`);
}

async function saveComments(comments, platform) {
  if (!comments?.length) return;
  for (const c of comments) {
    try {
      await query(
        `INSERT INTO recent_comments
           (platform,post_id,comment_id,username,comment_text,likes,published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (comment_id) DO NOTHING`,
        [
          platform,
          c.post_id || null,
          String(c.id || c.comment_id || Math.random()),
          c.username || c.authorDisplayName || 'anon',
          c.text || c.textDisplay || c.comment_text || '',
          Number(c.like_count || c.likeCount || 0),
          c.timestamp ? new Date(c.timestamp) : null,
        ]
      );
    } catch { /* duplicado */ }
  }
  logger.info(`💾 ${platform}: ${comments.length} comentarios guardados`);
}

// ── Sincronizaciones individuales ───────────────────────────
async function syncInstagram() {
  try {
    logger.info('📡 Sincronizando Instagram...');
    const [profile, insights] = await Promise.all([
      instagramAPI.getProfile(),
      instagramAPI.getInsights(),
    ]);
    const posts    = await instagramAPI.getRecentMedia(20);
    const comments = await instagramAPI.getComments();
    await saveMetrics(instagramAPI.normalize(profile, insights));
    await savePosts(posts, 'instagram');
    await saveComments(comments, 'instagram');
    return { metrics: instagramAPI.normalize(profile, insights), posts, comments };
  } catch (e) { logger.error('❌ Instagram: ' + e.message); return null; }
}

async function syncTikTok() {
  try {
    logger.info('📡 Sincronizando TikTok...');
    const [user, videos] = await Promise.all([tiktokAPI.getUserInfo(), tiktokAPI.getVideos(20)]);
    await saveMetrics(tiktokAPI.normalize(user, videos));
    await savePosts(videos, 'tiktok');
    return { metrics: tiktokAPI.normalize(user, videos), posts: videos };
  } catch (e) { logger.error('❌ TikTok: ' + e.message); return null; }
}

async function syncYouTube() {
  try {
    logger.info('📡 Sincronizando YouTube...');
    const [channel, videos] = await Promise.all([youtubeAPI.getChannel(), youtubeAPI.getVideos(20)]);
    const comments = videos[0] ? await youtubeAPI.getComments(videos[0].id, 20) : [];
    await saveMetrics(youtubeAPI.normalize(channel, videos));
    await savePosts(videos, 'youtube');
    await saveComments(comments, 'youtube');
    return { metrics: youtubeAPI.normalize(channel, videos), posts: videos, comments };
  } catch (e) { logger.error('❌ YouTube: ' + e.message); return null; }
}

async function syncSpotify(artistName) {
  try {
    logger.info('📡 Sincronizando Spotify...');
    const artist = await spotifyAPI.searchArtist(artistName);
    const albums = await spotifyAPI.getAlbums(artist.id);
    await saveMetrics(spotifyAPI.normalize(artist, albums));
    logger.info(`Spotify: ${artist.name} — ${artist.followers?.total} seguidores — ${albums.length} lanzamientos`);
    return { metrics: spotifyAPI.normalize(artist, albums) };
  } catch (e) {
    logger.error('❌ Spotify: ' + e.message);
    return null;
  }
}

async function syncTwitter(username) {
  try {
    logger.info('📡 Sincronizando Twitter/X...');
    const user   = await twitterAPI.getUserByUsername(username);
    const tweets = await twitterAPI.getTweets(user.id, 20);
    await saveMetrics(twitterAPI.normalize(user, tweets));
    await savePosts(tweets, 'twitter');
    return { metrics: twitterAPI.normalize(user, tweets), posts: tweets };
  } catch (e) { logger.error('❌ Twitter: ' + e.message); return null; }
}

async function syncDeezer() {
  try {
    logger.info('📡 Sincronizando Deezer...');
    const [artist, tracks] = await Promise.all([deezerAPI.getArtist(), deezerAPI.getTopTracks(10)]);
    await saveMetrics(deezerAPI.normalize(artist, tracks));
    return { metrics: deezerAPI.normalize(artist, tracks) };
  } catch (e) { logger.error('❌ Deezer: ' + e.message); return null; }
}

// ── SYNC COMPLETO ────────────────────────────────────────────
export async function syncAll(config = {}) {
  const t0 = Date.now();
  const artistName = config.artistName || process.env.ARTIST_NAME || 'Dos Rayos';
  const twitterUser = config.twitterUsername || process.env.TWITTER_USERNAME || 'dosrayos';

  logger.info('🚀 Iniciando sincronización completa...');

  const [ig, tt, yt, sp, tw, dz] = await Promise.allSettled([
    syncInstagram(),
    syncTikTok(),
    syncYouTube(),
    syncSpotify(artistName),
    syncTwitter(twitterUser),
    syncDeezer(),
  ]);

  const results = {
    instagram: ig.status === 'fulfilled' ? ig.value : null,
    tiktok:    tt.status === 'fulfilled' ? tt.value : null,
    youtube:   yt.status === 'fulfilled' ? yt.value : null,
    spotify:   sp.status === 'fulfilled' ? sp.value : null,
    twitter:   tw.status === 'fulfilled' ? tw.value : null,
    deezer:    dz.status === 'fulfilled' ? dz.value : null,
  };

  const synced = Object.values(results).filter(Boolean).length;
  logger.info(`✅ ${synced}/6 plataformas sincronizadas`);

  // Análisis de IA con todos los datos recolectados
  const allMetrics  = Object.values(results).filter(r => r?.metrics).map(r => r.metrics);
  const allPosts    = Object.values(results).filter(r => r?.posts).flatMap(r => r.posts);
  const allComments = Object.values(results).filter(r => r?.comments).flatMap(r => r.comments);

  if (allMetrics.length > 0) {
    try {
      await ai.analyzeBrand(allMetrics, allPosts, allComments);
      await ai.detectTopics(allPosts, allComments);
      const brand = await ai.getLatest('brand_identity');
      for (const plat of ['instagram', 'tiktok', 'youtube']) {
        await ai.generateIdeas(plat, brand?.result || {});
      }
    } catch (e) { logger.error('AI sync error: ' + e.message); }
  }

  logger.info(`⚡ Sincronización completada en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { results, synced, total: 6 };
}

// Ejecutar directamente: node src/services/syncAll.js
if (process.argv[1]?.includes('syncAll')) {
  syncAll()
    .then(r => { logger.info(`Listo: ${r.synced}/${r.total} plataformas`); process.exit(0); })
    .catch(e => { logger.error(e.message); process.exit(1); });
}
