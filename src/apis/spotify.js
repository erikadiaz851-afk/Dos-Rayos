import axios from 'axios';
import logger from '../utils/logger.js';

const BASE  = 'https://api.spotify.com/v1';
const TOKEN = 'https://accounts.spotify.com/api/token';

class SpotifyAPI {
  constructor() {
    this.clientId     = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this._token  = null;
    this._expiry = 0;
  }

  async _ensureToken() {
    if (this._token && this._expiry > Date.now()) return;
    const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const { data } = await axios.post(
      TOKEN,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    this._token  = data.access_token;
    this._expiry = Date.now() + (data.expires_in - 60) * 1000;
    logger.debug('Spotify: token renovado');
  }

  get _h() { return { Authorization: `Bearer ${this._token}` }; }

  async searchArtist(name) {
    await this._ensureToken();
    const { data } = await axios.get(`${BASE}/search`, {
      headers: this._h,
      params: { q: name, type: 'artist', limit: 1 },
    });
    const artist = data.artists?.items?.[0];
    if (!artist) throw new Error(`Artista "${name}" no encontrado`);
    logger.info(`Spotify: ${artist.name} — ${artist.followers?.total?.toLocaleString()} seguidores`);
    return artist;
  }

  async getTopTracks(artistId, market = 'US') {
    await this._ensureToken();
    try {
      const { data } = await axios.get(`${BASE}/artists/${artistId}/top-tracks`, {
        headers: this._h, params: { market },
      });
      return data.tracks || [];
    } catch (e) {
      logger.error('Spotify getTopTracks: ' + e.message);
      return [];
    }
  }

  async getAlbums(artistId) {
    await this._ensureToken();
    try {
      const { data } = await axios.get(`${BASE}/artists/${artistId}/albums`, {
        headers: this._h,
        params: { include_groups: 'album,single', limit: 20, market: 'CO' },
      });
      return data.items || [];
    } catch (e) {
      return [];
    }
  }

  normalize(artist, tracks) {
    return {
      platform:        'spotify',
      followers:       artist.followers?.total || 0,
      posts_count:     tracks.length,
      avg_views:       tracks.reduce((s, t) => s + (t.popularity || 0), 0) / (tracks.length || 1),
      engagement_rate: (artist.popularity || 0) / 100,
      raw_data: {
        id:         artist.id,
        name:       artist.name,
        genres:     artist.genres || [],
        popularity: artist.popularity || 0,
        followers:  artist.followers?.total || 0,
        images:     artist.images || [],
        url:        artist.external_urls?.spotify,
        top_tracks: tracks.slice(0, 5).map(t => ({
          name:       t.name,
          popularity: t.popularity,
          preview:    t.preview_url,
          album:      t.album?.name,
        })),
      },
    };
  }
}

export default new SpotifyAPI();