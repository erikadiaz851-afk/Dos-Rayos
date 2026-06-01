# ⚡ Dos Rayos — Backend Dashboard

Backend Node.js + Express que conecta todas las redes sociales de Dos Rayos y expone una API REST para el dashboard React.

## Arrancar en 3 pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Crear y rellenar el archivo de configuración
cp .env.example .env
# Abre .env en VS Code y rellena tus credenciales

# 3. Arrancar el servidor
npm run dev
# → http://localhost:3000
```

## Scripts disponibles

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor en desarrollo con hot-reload |
| `npm start` | Servidor en producción |
| `npm run sync` | Sincronización manual de todas las plataformas |

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servidor |
| GET | `/auth/status` | Plataformas conectadas |
| GET | `/api/summary` | Resumen ejecutivo |
| GET | `/api/metrics` | Métricas de todas las plataformas |
| GET | `/api/metrics/:platform/history` | Histórico de una plataforma |
| GET | `/api/posts` | Publicaciones recientes |
| GET | `/api/posts/top` | Top posts por engagement |
| GET | `/api/comments` | Últimos comentarios |
| GET | `/api/analysis/brand` | Análisis de marca IA |
| GET | `/api/analysis/content-ideas` | Ideas de contenido IA |
| GET | `/api/analysis/topics` | Temas predominantes IA |
| GET | `/api/calendar` | Parrilla de contenido |
| POST | `/api/calendar` | Agregar publicación planificada |
| POST | `/api/sync` | Sincronización manual |

## Vincular cuentas OAuth (una sola vez)

Con el servidor corriendo, abre en el navegador:

```
http://localhost:3000/auth/spotify   → Conectar Spotify
http://localhost:3000/auth/youtube   → Conectar YouTube  
http://localhost:3000/auth/tiktok    → Conectar TikTok
http://localhost:3000/auth/meta      → Instrucciones Instagram
```

## Estructura del proyecto

```
src/
├── apis/
│   ├── instagram.js   Meta Graph API
│   ├── tiktok.js      TikTok for Developers
│   ├── youtube.js     YouTube Data API v3
│   ├── spotify.js     Spotify Web API
│   ├── twitter.js     Twitter/X API v2
│   └── music.js       Deezer + Apple Music
├── services/
│   ├── syncAll.js     Orquestador de sincronización
│   └── aiAnalysis.js  Claude AI para análisis
├── routes/
│   ├── dashboard.js   Endpoints REST
│   └── auth.js        Flujos OAuth 2.0
├── utils/
│   ├── database.js    Conexión PostgreSQL/Supabase
│   └── logger.js      Sistema de logs
└── index.js           Servidor Express principal
config/
└── schema.sql         Esquema de base de datos
```

---
*Dos Rayos · "Dos Piezas de Un Mismo Cielo" · Anymal Media*
