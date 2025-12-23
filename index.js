/**
 * Stremio France.tv Addon
 *
 * Addon pour accéder aux replays France Télévisions.
 * France 2, France 3, France 4, France 5, franceinfo, Slash
 *
 * @version 1.0.0
 */

require('dotenv').config();

const { addonBuilder } = require('stremio-addon-sdk');
const express = require('express');
const FranceTVClient = require('./lib/francetv');

// Configuration
const PORT = process.env.PORT || 7000;
const ADDON_URL = process.env.ADDON_URL || `http://localhost:${PORT}`;

// Client France.tv
const francetv = new FranceTVClient();

// Préfixe pour les IDs Stremio
const ID_PREFIX = 'francetv:';

/**
 * Définition du manifest de l'addon
 */
const manifest = {
    id: 'community.stremio.francetv',
    version: '1.0.0',
    name: 'France.tv',
    description: 'Replay gratuit France Télévisions - France 2, France 3, France 4, France 5, franceinfo, Slash',
    logo: 'https://www.france.tv/image/vignette_3x4/280/420/p/l/e/phpqlzple.png',
    background: 'https://www.france.tv/image/background_16x9/2500/1400/j/k/s/phpn0qskj.jpg',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series', 'tv'],
    catalogs: [
        {
            type: 'movie',
            id: 'francetv-france-2',
            name: 'France 2',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'francetv-france-3',
            name: 'France 3',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'francetv-france-5',
            name: 'France 5',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'francetv-france-4',
            name: 'France 4',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'francetv-franceinfo',
            name: 'franceinfo',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'francetv-slash',
            name: 'France tv Slash',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'francetv-sport',
            name: '⚽ Sport',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'series',
            id: 'francetv-series-et-fictions',
            name: '📺 Séries & Fictions',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'francetv-rugby',
            name: '🏉 Rugby',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'francetv-papotin',
            name: '🎤 Le Papotin',
            extra: [{ name: 'skip', isRequired: false }]
        },
        {
            type: 'movie',
            id: 'francetv-emissions',
            name: '📻 Émissions TV',
            extra: [{ name: 'skip', isRequired: false }, { name: 'search', isRequired: false }]
        }
    ],
    idPrefixes: [ID_PREFIX]
};

// Création du builder
const builder = new addonBuilder(manifest);

/**
 * Handler pour le catalogue
 */
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    console.log(`[Addon] Catalogue demandé: ${id} (type: ${type})`);

    const skip = parseInt(extra?.skip) || 0;
    const limit = 50;

    // Extrait l'ID de la chaîne
    const channelId = id.replace('francetv-', '');

    try {
        let videos = [];

        // Gestion des catalogues spéciaux
        if (channelId === 'rugby') {
            videos = await francetv.getRugbyContent();
        } else if (channelId === 'papotin') {
            videos = await francetv.search('papotin');
        } else if (channelId === 'emissions') {
            // Si recherche spécifiée, sinon émissions populaires
            const searchQuery = extra?.search || '';
            if (searchQuery) {
                videos = await francetv.search(searchQuery);
            } else {
                // Émissions populaires par défaut
                const popular = ['papotin', 'quotidien', 'grande librairie', 'on est en direct', 'c dans l\'air'];
                for (const q of popular) {
                    const results = await francetv.search(q);
                    videos.push(...results.slice(0, 10));
                }
            }
        } else {
            videos = await francetv.getChannelContent(channelId);
        }

        // Pagination
        const paginated = videos.slice(skip, skip + limit);

        // Formate pour Stremio (utilise le type demandé)
        const metas = paginated.map(video => ({
            id: `${ID_PREFIX}${video.id}`,
            type: type,
            name: video.title,
            poster: video.image,
            posterShape: 'landscape',
            description: video.description,
            background: video.image
        }));

        console.log(`[Addon] Retour de ${metas.length} résultats (skip: ${skip})`);
        return { metas };

    } catch (error) {
        console.error(`[Addon] Erreur catalogue ${id}:`, error.message);
        return { metas: [] };
    }
});

/**
 * Handler pour les métadonnées
 */
builder.defineMetaHandler(async ({ type, id }) => {
    console.log(`[Addon] Meta demandée: ${id} (type: ${type})`);

    const videoId = id.replace(ID_PREFIX, '');

    try {
        const video = await francetv.getVideoInfo(videoId);

        if (!video) {
            return { meta: null };
        }

        // Durée en format lisible
        const hours = Math.floor((video.duration || 0) / 3600);
        const minutes = Math.floor(((video.duration || 0) % 3600) / 60);
        const runtime = hours > 0 ? `${hours}h${minutes}min` : `${minutes}min`;

        return {
            meta: {
                id: id,
                type: type,
                name: video.title,
                poster: video.image,
                posterShape: 'landscape',
                background: video.image,
                description: video.description,
                runtime: runtime,
                genres: ['France.tv', 'Replay']
            }
        };

    } catch (error) {
        console.error(`[Addon] Erreur meta ${id}:`, error.message);
        return { meta: null };
    }
});

/**
 * Handler pour les streams
 */
builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`[Addon] Stream demandé: ${id} (type: ${type})`);

    const videoId = id.replace(ID_PREFIX, '');

    try {
        const video = await francetv.getVideoInfo(videoId);

        if (!video) {
            console.log(`[Addon] Pas de vidéo pour ${videoId}`);
            return { streams: [] };
        }

        if (video.drm) {
            console.log(`[Addon] Vidéo ${videoId} protégée par DRM`);
            return {
                streams: [{
                    name: 'France.tv',
                    title: `${video.title}\n⚠️ Protégé par DRM - Non disponible`,
                    externalUrl: `https://www.france.tv/`
                }]
            };
        }

        if (!video.streamUrl) {
            console.log(`[Addon] Pas de stream pour ${videoId}`);
            return { streams: [] };
        }

        console.log(`[Addon] Stream trouvé: ${video.streamUrl}`);

        return {
            streams: [{
                name: 'France.tv',
                title: `${video.title}\n🇫🇷 Français`,
                url: video.streamUrl,
                behaviorHints: {
                    notWebReady: false
                }
            }]
        };

    } catch (error) {
        console.error(`[Addon] Erreur stream ${id}:`, error.message);
        return { streams: [] };
    }
});

// Interface de l'addon
const addonInterface = builder.getInterface();

// Serveur Express
const app = express();

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Route santé
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        addon: 'France.tv',
        version: manifest.version
    });
});

// Monte l'addon
const { getRouter } = require('stremio-addon-sdk');
app.use(getRouter(addonInterface));

// Démarrage
app.listen(PORT, () => {
    console.log(`
[Addon] ========================================
[Addon] France.tv Addon v${manifest.version} démarré!
[Addon] Port: ${PORT}
[Addon] URL publique: ${ADDON_URL}
[Addon] Manifest: ${ADDON_URL}/manifest.json
[Addon] ========================================

[Addon] Catalogues disponibles:
[Addon]   - France 2, France 3, France 4, France 5
[Addon]   - franceinfo, France tv Slash
[Addon]   - Sport, Séries & Fictions
[Addon]   - 🏉 Rugby, 🎤 Le Papotin
[Addon]   - 📻 Émissions TV (avec recherche)
[Addon] ========================================

[Addon] Note: Certains contenus protégés par DRM
[Addon] ne seront pas lisibles.
[Addon] ========================================
`);
});
