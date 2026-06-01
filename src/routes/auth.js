import { Router } from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = Router();

const host = () => process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

// ── Estado de todas las conexiones ───────────────────────────
router.get('/status', (req, res) => {
  const status = {
    instagram:   !!(process.env.META_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
    facebook:    !!(process.env.META_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID),
    tiktok:      !!process.env.TIKTOK_ACCESS_TOKEN,
    youtube:     !!process.env.YOUTUBE_REFRESH_TOKEN,
    spotify:     !!process.env.SPOTIFY_REFRESH_TOKEN,
    twitter:     !!process.env.TWITTER_BEARER_TOKEN,
    deezer:      !!process.env.DEEZER_ARTIST_ID,
    apple_music: !!process.env.APPLE_KEY_ID,
  };
  const connected = Object.values(status).filter(Boolean).length;
  res.json({
    connected_platforms: connected,
    total_platforms:     Object.keys(status).length,
    status,
    oauth_urls: {
      spotify: `${host()}/auth/spotify`,
      youtube: `${host()}/auth/youtube`,
      tiktok:  `${host()}/auth/tiktok`,
      meta:    `${host()}/auth/meta`,
    },
  });
});

// ── SPOTIFY OAuth ─────────────────────────────────────────────
router.get('/spotify', (req, res) => {
  const scopes = 'user-read-private user-read-email user-top-read user-read-recently-played playlist-read-private user-follow-read';
  res.redirect(
    `https://accounts.spotify.com/authorize?` +
    new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: 'http://127.0.0.1:3000/auth/spotify/callback',
      scope: scopes,
    })
  );
});

router.get('/spotify/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: 'http://127.0.0.1:3000/auth/spotify/callback' }),
      { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    logger.info('Spotify OAuth: completado');
    res.send(successPage('Spotify', `SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`));
  } catch (e) {
    res.status(500).send(errorPage('Spotify', e.response?.data?.error || e.message));
  }
});

// ── YOUTUBE OAuth ─────────────────────────────────────────────
router.get('/youtube', (req, res) => {
  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID,
      redirect_uri: `${host()}/auth/youtube/callback`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
      access_type: 'offline',
      prompt: 'consent',
    })
  );
});

router.get('/youtube/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      redirect_uri: `${host()}/auth/youtube/callback`,
      grant_type: 'authorization_code',
      code,
    });
    logger.info('YouTube OAuth: completado');
    res.send(successPage('YouTube', `YOUTUBE_REFRESH_TOKEN=${data.refresh_token}`));
  } catch (e) {
    res.status(500).send(errorPage('YouTube', e.response?.data?.error || e.message));
  }
});

// ── TIKTOK OAuth ──────────────────────────────────────────────
router.get('/tiktok', (req, res) => {
  res.redirect(
    `https://www.tiktok.com/v2/auth/authorize?` +
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      scope: 'user.info.basic,video.list,video.insights',
      response_type: 'code',
      redirect_uri: `${host()}/auth/tiktok/callback`,
      state: 'dos_rayos_auth',
    })
  );
});

router.get('/tiktok/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { data } = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code, grant_type: 'authorization_code',
        redirect_uri: `${host()}/auth/tiktok/callback`,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    logger.info('TikTok OAuth: completado');
    res.send(successPage('TikTok',
      `TIKTOK_ACCESS_TOKEN=${data.access_token}\nTIKTOK_REFRESH_TOKEN=${data.refresh_token}`
    ));
  } catch (e) {
    res.status(500).send(errorPage('TikTok', e.response?.data?.message || e.message));
  }
});

// ── META / INSTAGRAM ──────────────────────────────────────────
router.get('/meta', (req, res) => {
  res.send(`
    <html><head><meta charset="UTF-8"><style>
      body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#f0f0e8;padding:40px;max-width:600px;margin:0 auto}
      h2{color:#FFCE47;margin-bottom:20px} code{background:#1a1a1a;padding:4px 10px;border-radius:6px;color:#FFCE47;font-size:13px}
      ol{line-height:2.2;color:#ccc} a{color:#89C6E9}
    </style></head><body>
    <h2>⚡ Conectar Instagram + Facebook</h2>
    <ol>
      <li>Ve a <a href="https://developers.facebook.com/tools/explorer" target="_blank">Graph API Explorer</a></li>
      <li>Selecciona tu App → User or Page</li>
      <li>Permisos: <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>pages_read_engagement</code></li>
      <li>Clic en "Generate Access Token" → inicia sesión con tu cuenta</li>
      <li>Copia el token y guárdalo como <code>META_ACCESS_TOKEN</code> en tu .env</li>
      <li>Para obtener el ID de tu cuenta de Instagram Business:<br>
        En el Explorer escribe: <code>/me/accounts</code> → busca tu cuenta → copia el id</li>
      <li>Guárdalo como <code>INSTAGRAM_BUSINESS_ACCOUNT_ID</code></li>
    </ol>
    <p style="margin-top:20px;color:#555;font-size:12px">Nota: el token dura 60 días. Renuévalo con el endpoint de long-lived token.</p>
    </body></html>
  `);
});

// ── Helpers HTML ──────────────────────────────────────────────
function successPage(platform, tokenLine) {
  return `
    <html><head><meta charset="UTF-8"><style>
      body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#f0f0e8;padding:40px;max-width:600px;margin:0 auto;text-align:center}
      h2{color:#83DAB0;font-size:24px;margin-bottom:10px} pre{background:#001a0d;border:1px solid #003320;border-radius:10px;padding:16px;text-align:left;font-size:13px;color:#83DAB0;margin:20px 0;white-space:pre-wrap;word-break:break-all}
      p{color:#888;font-size:13px;line-height:1.6}
    </style></head><body>
    <h2>✅ ${platform} conectado</h2>
    <p>Copia esta línea y pégala en tu archivo <strong>.env</strong>:</p>
    <pre>${tokenLine}</pre>
    <p>Luego reinicia el servidor con <strong>Ctrl+C</strong> y <strong>npm run dev</strong>.</p>
    </body></html>`;
}

function errorPage(platform, msg) {
  return `
    <html><head><meta charset="UTF-8"><style>
      body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#f0f0e8;padding:40px;max-width:600px;margin:0 auto;text-align:center}
      h2{color:#ff6b6b} pre{background:#1a0000;border:1px solid #3d0000;border-radius:10px;padding:16px;text-align:left;font-size:13px;color:#ff6b6b;margin:20px 0}
    </style></head><body>
    <h2>❌ Error con ${platform}</h2>
    <pre>${msg}</pre>
    <p style="color:#888">Verifica que las credenciales en tu .env son correctas y vuelve a intentar.</p>
    </body></html>`;
}

export default router;
