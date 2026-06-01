import axios from 'axios';
import logger from '../utils/logger.js';

// ─── DEEZER ─────────────────────────────────────────────────
class DeezerAPI {
  constructor() {
    this.artistId = process.env.DEEZER_ARTIST_ID;
  }

  async getArtist() {
    const { data } = await axios.get(`https://api.deezer.com/artist/${this.artistId}`);
    logger.info(`Deezer: ${data.name} (${data.nb_fan} fans)`);
    return data;
  }

  async getTopTracks(limit = 10) {
    const { data } = await axios.get(`https://api.deezer.com/artist/${this.artistId}/top`, {
      params: { limit },
    });
    return data.data || [];
  }

  async getCharts() {
    const { data } = await axios.get('https://api.deezer.com/chart/0/tracks');
    return data.data?.slice(0, 20) || [];
  }

  normalize(artist, tracks) {
    return {
      platform:    'deezer',
      followers:   artist.nb_fan  || 0,
      posts_count: artist.nb_album || 0,
      raw_data: {
        id:      artist.id,
        name:    artist.name,
        picture: artist.picture_big,
        nb_fan:  artist.nb_fan,
        link:    artist.link,
        top_tracks: tracks.slice(0, 5).map(t => ({
          title:   t.title,
          rank:    t.rank,
          preview: t.preview,
        })),
      },
    };
  }
}

// ─── APPLE MUSIC ────────────────────────────────────────────
import { readFileSync, existsSync } from 'fs';
import { createSign } from 'crypto';

class AppleMusicAPI {
  constructor() {
    this.teamId  = process.env.APPLE_TEAM_ID;
    this.keyId   = process.env.APPLE_KEY_ID;
    this.keyPath = process.env.APPLE_PRIVATE_KEY_PATH;
    this._token  = null;
    this._expiry = 0;
  }

  _generateToken() {
    if (this._token && this._expiry > Date.now()) return this._token;
    if (!this.keyPath || !existsSync(this.keyPath)) {
      logger.warn('Apple Music: archivo de clave privada no encontrado');
      return null;
    }
    const privateKey = readFileSync(this.keyPath, 'utf8');
    const now  = Math.floor(Date.now() / 1000);
    const exp  = now + 15897600;
    const enc  = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const h    = enc({ alg: 'ES256', kid: this.keyId });
    const p    = enc({ iss: this.teamId, iat: now, exp });
    const sign = createSign('SHA256');
    sign.write(`${h}.${p}`); sign.end();
    const sig  = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }, 'base64url');
    this._token  = `${h}.${p}.${sig}`;
    this._expiry = exp * 1000;
    return this._token;
  }

  async searchArtist(name, storefront = 'co') {
    const token = this._generateToken();
    if (!token) return null;
    try {
      const { data } = await axios.get(
        `https://api.music.apple.com/v1/catalog/${storefront}/search`,
        { headers: { Authorization: `Bearer ${token}` }, params: { term: name, types: 'artists', limit: 1 } }
      );
      const artist = data.results?.artists?.data?.[0];
      logger.info(`Apple Music: ${artist?.attributes?.name}`);
      return artist;
    } catch (e) {
      logger.error('Apple Music searchArtist: ' + e.message);
      return null;
    }
  }

  normalize(artist) {
    return {
      platform:    'apple_music',
      followers:   0,
      posts_count: 0,
      raw_data:    {
        id:     artist?.id,
        name:   artist?.attributes?.name,
        genres: artist?.attributes?.genreNames,
        url:    artist?.attributes?.url,
      },
    };
  }
}

export const deezerAPI    = new DeezerAPI();
export const appleMusicAPI = new AppleMusicAPI();
