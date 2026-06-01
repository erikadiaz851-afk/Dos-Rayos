import { Router } from 'express';
import { query }   from '../utils/database.js';
import { syncAll } from '../services/syncAll.js';
import ai          from '../services/aiAnalysis.js';
import logger      from '../utils/logger.js';

const router = Router();

// ── Resumen ejecutivo ────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const [metricsR, postsR, commentsR] = await Promise.all([
      query(`SELECT DISTINCT ON (platform) platform,followers,engagement_rate,fetched_at
             FROM platform_metrics ORDER BY platform, fetched_at DESC`),
      query(`SELECT platform, COUNT(*) as total FROM posts GROUP BY platform`),
      query(`SELECT sentiment, COUNT(*) as total FROM recent_comments WHERE sentiment IS NOT NULL GROUP BY sentiment`),
    ]);
    const totalFollowers = metricsR.rows.reduce((s, r) => s + (parseInt(r.followers) || 0), 0);
    res.json({
      success: true,
      data: {
        total_followers:     totalFollowers,
        platforms:           metricsR.rows,
        posts_by_platform:   postsR.rows,
        sentiment:           commentsR.rows,
        last_sync:           metricsR.rows[0]?.fetched_at || null,
      },
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Métricas ─────────────────────────────────────────────────
router.get('/metrics', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT ON (platform)
         platform,followers,following,posts_count,avg_likes,avg_comments,
         avg_views,reach_7d,impressions_7d,engagement_rate,fetched_at
       FROM platform_metrics ORDER BY platform, fetched_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/metrics/:platform/history', async (req, res) => {
  try {
    const { platform } = req.params;
    const days = parseInt(req.query.days) || 30;
    const { rows } = await query(
      `SELECT platform,followers,engagement_rate,reach_7d,impressions_7d,fetched_at
       FROM platform_metrics
       WHERE platform=$1 AND fetched_at >= NOW() - ($2 || ' days')::INTERVAL
       ORDER BY fetched_at ASC`,
      [platform, days]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Posts ────────────────────────────────────────────────────
router.get('/posts', async (req, res) => {
  try {
    const { platform, limit = 20, type } = req.query;
    const conditions = [];
    const params     = [];
    if (platform) { conditions.push(`platform = $${params.length + 1}`); params.push(platform); }
    if (type)     { conditions.push(`post_type = $${params.length + 1}`); params.push(type); }
    params.push(parseInt(limit));
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT id,platform,post_id,post_type,title,description,published_at,
              likes,comments,shares,views,saves,reach,thumbnail_url,post_url
       FROM posts ${where} ORDER BY published_at DESC NULLS LAST LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: rows, count: rows.length });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/posts/top', async (req, res) => {
  try {
    const { platform, limit = 10 } = req.query;
    const where  = platform ? `WHERE platform = $1` : '';
    const params = platform ? [platform, parseInt(limit)] : [parseInt(limit)];
    const { rows } = await query(
      `SELECT *, (likes + comments*2 + shares*3) AS engagement_score
       FROM posts ${where}
       ORDER BY engagement_score DESC LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Comentarios ──────────────────────────────────────────────
router.get('/comments', async (req, res) => {
  try {
    const { platform, limit = 50 } = req.query;
    const where  = platform ? `WHERE platform = $1` : '';
    const params = platform ? [platform, parseInt(limit)] : [parseInt(limit)];
    const { rows } = await query(
      `SELECT * FROM recent_comments ${where}
       ORDER BY published_at DESC NULLS LAST LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Análisis IA ──────────────────────────────────────────────
router.get('/analysis/brand', async (req, res) => {
  try {
    const r = await ai.getLatest('brand_identity');
    res.json({ success: true, data: r?.result || null, created_at: r?.created_at });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/analysis/content-ideas', async (req, res) => {
  try {
    const { platform, limit = 20 } = req.query;
    const where  = platform ? `WHERE platform = $1` : '';
    const params = platform ? [platform, parseInt(limit)] : [parseInt(limit)];
    const { rows } = await query(
      `SELECT * FROM content_ideas ${where}
       ORDER BY trend_score DESC, created_at DESC LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/analysis/topics', async (req, res) => {
  try {
    const r = await ai.getLatest('topics');
    res.json({ success: true, data: r?.result || null });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Calendario ────────────────────────────────────────────────
router.get('/calendar', async (req, res) => {
  try {
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const { rows } = await query(
      `SELECT cc.*, ci.topic, ci.format, ci.hashtags
       FROM content_calendar cc
       LEFT JOIN content_ideas ci ON cc.content_idea_id = ci.id
       WHERE EXTRACT(MONTH FROM cc.scheduled_at) = $1
         AND EXTRACT(YEAR  FROM cc.scheduled_at) = $2
       ORDER BY cc.scheduled_at ASC`,
      [month, year]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/calendar', async (req, res) => {
  try {
    const { platform, scheduled_at, content_idea_id, title, notes } = req.body;
    const { rows } = await query(
      `INSERT INTO content_calendar (platform,scheduled_at,content_idea_id,title,notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [platform, scheduled_at, content_idea_id || null, title, notes]
    );
    res.json({ success: true, data: rows[0] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.patch('/calendar/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const { rows } = await query(
      `UPDATE content_calendar SET status=$1 WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Sincronización manual ─────────────────────────────────────
router.post('/sync', async (req, res) => {
  res.json({ success: true, message: 'Sincronización iniciada en background' });
  try {
    await syncAll(req.body || {});
  } catch (e) { logger.error('Sync manual: ' + e.message); }
});

export default router;
