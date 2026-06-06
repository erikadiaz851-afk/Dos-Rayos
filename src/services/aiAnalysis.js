import Anthropic from '@anthropic-ai/sdk';
import { query } from '../utils/database.js';
import logger from '../utils/logger.js';

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const JSON_PROMPT = 'Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques de código.';

class AIService {

  async _call(prompt, maxTokens = 1500) {
    const res = await ai.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = res.content[0]?.text || '{}';
    try {
      return { result: JSON.parse(raw.replace(/```json|```/g, '').trim()), tokens: res.usage?.input_tokens + res.usage?.output_tokens };
    } catch {
      logger.error('AI: JSON inválido recibido');
      return { result: {}, tokens: 0 };
    }
  }

  async analyzeBrand(metrics, posts, comments) {
    logger.info('AI: analizando marca Dos Rayos...');
    const prompt = `
Eres un experto en marketing digital y marca personal de artistas latinoamericanos.
Analiza los siguientes datos de Dos Rayos (dúo de gemelas colombianas, artistas multidisciplinares).

MÉTRICAS:
${JSON.stringify(metrics.slice(0, 5))}

PUBLICACIONES RECIENTES (${posts.length}):
${JSON.stringify(posts.slice(0, 10).map(p => ({ platform: p.platform, type: p.post_type, likes: p.likes, views: p.views, desc: (p.description || '').slice(0, 100) })))}

COMENTARIOS RECIENTES (${comments.length}):
${JSON.stringify(comments.slice(0, 20).map(c => ({ platform: c.platform, text: (c.comment_text || '').slice(0, 120) })))}

${JSON_PROMPT}
{
  "brand_identity": {
    "tone": "",
    "style": "",
    "key_themes": [],
    "strengths": [],
    "opportunities": [],
    "brand_personality": ""
  },
  "audience_analysis": {
    "profile": "",
    "interests": [],
    "engagement_patterns": "",
    "sentiment": "",
    "top_concerns": []
  },
  "content_performance": {
    "best_formats": [],
    "best_topics": [],
    "best_platforms": [],
    "posting_consistency_score": 0,
    "avg_engagement_rate": 0,
    "content_gaps": []
  },
  "communication_style": {
    "language_register": "",
    "key_phrases": [],
    "emotional_tone": "",
    "cta_patterns": ""
  },
  "summary": ""
}`;
    const { result, tokens } = await this._call(prompt, 2000);
    await this._save('brand_identity', null, result, tokens);
    logger.info('AI: análisis de marca completado');
    return result;
  }

  async generateIdeas(platform, brand, trends = []) {
    logger.info(`AI: generando ideas para ${platform}...`);
    const guides = {
      instagram: 'Reels 15-30s, carruseles, stories interactivas',
      tiktok:    'Videos 15-60s, trends de audio, duetos',
      youtube:   'Videos 5-20 min, shorts, vlogs, tutoriales',
      twitter:   'Hilos de valor, tweets de opinión, encuestas',
      spotify:   'Singles, EPs, playlists temáticas',
    };
    const prompt = `
Eres estratega de contenido para Dos Rayos, dúo de gemelas colombianas. Su concepto es "Energía Cómplice". Paleta: Amarillo Rayo, Azul Cielo. Pilares: Gemelas, Parchadas, Empáticas, Energía, Versatilidad.

Plataforma: ${platform.toUpperCase()}
Guía de formato: ${guides[platform] || 'contenido original'}
Contexto de marca: ${JSON.stringify(brand?.brand_identity || {})}

Genera 8 ideas de contenido estratégicas, originales y alineadas con la identidad de Dos Rayos.

${JSON_PROMPT}
{
  "ideas": [
    {
      "topic": "",
      "format": "",
      "hook": "",
      "description": "",
      "hashtags": [],
      "trend_score": 0,
      "why_it_works": ""
    }
  ],
  "platform_strategy": "",
  "best_posting_times": [],
  "content_pillars": []
}`;
    const { result, tokens } = await this._call(prompt, 2500);
    await this._save('content_ideas', platform, result, tokens);
    if (result.ideas?.length) {
      for (const idea of result.ideas) {
        try {
          await query(
            `INSERT INTO content_ideas (platform, topic, format, hook, description, hashtags, trend_score)
             VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
            [platform, idea.topic, idea.format, idea.hook, idea.description, idea.hashtags || [], idea.trend_score || 0]
          );
        } catch { /* duplicado */ }
      }
    }
    logger.info(`AI: ${result.ideas?.length || 0} ideas generadas para ${platform}`);
    return result;
  }

  async detectTopics(posts, comments) {
    const texts = [
      ...posts.map(p => p.description || p.title || ''),
      ...comments.map(c => c.comment_text || ''),
    ].filter(Boolean).slice(0, 40);

    const prompt = `
Analiza estos textos de redes sociales de Dos Rayos e identifica temas, tendencias y estilo narrativo.

TEXTOS:
${texts.join('\n---\n')}

${JSON_PROMPT}
{
  "main_topics": [],
  "secondary_topics": [],
  "trending_keywords": [],
  "narrative_style": "",
  "recurring_elements": [],
  "audience_questions": [],
  "topic_frequency": {}
}`;
    const { result } = await this._call(prompt, 800);
    await this._save('topics', null, result, 0);
    return result;
  }

  async sentimentBatch(comments) {
    if (!comments?.length) return [];
    const prompt = `
Analiza el sentimiento de estos comentarios. Responde solo JSON array.

${comments.slice(0, 30).map((c, i) => `${i}. "${(c.comment_text || c.text || '').slice(0, 120)}"`).join('\n')}

${JSON_PROMPT}
[{"index":0,"sentiment":"positive","emotion":"admiración"}]`;
    const { result } = await this._call(prompt, 600);
    return Array.isArray(result) ? result : [];
  }

  async _save(type, platform, result, tokens) {
    try {
      await query(
        `INSERT INTO ai_analysis (analysis_type, platform, result, tokens_used) VALUES ($1,$2,$3,$4)`,
        [type, platform, JSON.stringify(result), tokens || 0]
      );
    } catch (e) { logger.error('AI._save: ' + e.message); }
  }

  async getLatest(type, platform = null) {
    const res = await query(
      `SELECT * FROM ai_analysis WHERE analysis_type=$1 AND ($2::text IS NULL OR platform=$2)
       ORDER BY created_at DESC LIMIT 1`,
      [type, platform]
    );
    return res.rows[0] || null;
  }
}

export default new AIService();
