/**
 * index.js - 18 Distinct 2D Cinematic Scene Archetypes Registry & Dispatcher
 * Stages of Denial (v16.0 Modular Architecture)
 */

import { renderKineticPrismScene } from './kineticPrismScene.js';
import { renderRainMistScene } from './rainMistScene.js';
import { renderEmberStormScene } from './emberStormScene.js';
import { renderCelestialDriftScene } from './celestialDriftScene.js';
import { renderAnalogWaveScene } from './analogWaveScene.js';
import { renderEditorialSilkScene } from './editorialSilkScene.js';
import { renderSakuraPetalsScene } from './sakuraPetalsScene.js';
import { renderAuroraCurtainScene } from './auroraCurtainScene.js';
import { renderMonolithBarsScene } from './monolithBarsScene.js';
import { renderLiquidHorizonScene } from './liquidHorizonScene.js';
import { renderCyberGridScene } from './cyberGridScene.js';
import { renderFireflyMeadowScene } from './fireflyMeadowScene.js';
import { renderVinylTurntableScene } from './vinylTurntableScene.js';
import { renderEclipseCoronaScene } from './eclipseCoronaScene.js';
import { renderSnowfallQuietScene } from './snowfallQuietScene.js';
import { renderPrismKaleidoscopeScene } from './prismKaleidoscopeScene.js';
import { renderRadarSonarScene } from './radarSonarScene.js';
import { renderGoldenDustRaysScene } from './goldenDustRaysScene.js';

export const SCENE_ARCHETYPES = [
  { id: 'kinetic-prism', name: 'Kinetic Prism', icon: '⚡', desc: 'Laser speed streaks & beat chevrons', genre: 'J-Pop, Tokusatsu, Ska, High-Tempo' },
  { id: 'rain-mist', name: 'Rain Mist', icon: '🌧️', desc: 'Soft mist, slanted rain & streetlamp bokeh', genre: 'Melancholy, Pop Soul' },
  { id: 'ember-storm', name: 'Ember Storm', icon: '🔥', desc: 'Rising embers, storm lightning & shockwaves', genre: 'Post-Rock, Emo, Amarah' },
  { id: 'celestial-drift', name: 'Celestial Drift', icon: '✨', desc: 'Constellation network & stardust parallax', genre: 'Indie Pop, Dreamy' },
  { id: 'analog-wave', name: 'Analog Wave', icon: '📻', desc: 'Dual oscilloscope beam & warm film halation', genre: 'Retro Pop, Jazz' },
  { id: 'editorial-silk', name: 'Editorial Silk', icon: '🌌', desc: '3-Layer fluid silk aurora & god-rays', genre: 'Orchestral, Dramatic' },
  { id: 'sakura-petals', name: 'Sakura Petals', icon: '🌸', desc: 'Fluttering petal drift & twilight glow', genre: 'Folk, Acoustic, Nostalgia' },
  { id: 'aurora-curtain', name: 'Aurora Curtain', icon: '🌠', desc: 'Vertical shimmering curtains dancing in night sky', genre: 'Ambient, Ballad' },
  { id: 'monolith-bars', name: 'Monolith Bars', icon: '🏛️', desc: 'Architectural light pillars rising to spectrum', genre: 'Post-Hardcore, Dramatic' },
  { id: 'liquid-horizon', name: 'Liquid Horizon', icon: '🌊', desc: 'Layered ocean waves with specular moon shimmer', genre: 'Romantic, R&B' },
  { id: 'cyber-grid', name: 'Cyber Grid', icon: '🌆', desc: 'Outrun perspective grid floor & retro neon sun', genre: 'Electronic, Synth-Pop' },
  { id: 'firefly-meadow', name: 'Firefly Meadow', icon: '🌿', desc: 'Organic pulsing fireflies over night meadow', genre: 'Indie Folk, Acoustic' },
  { id: 'vinyl-turntable', name: 'Vinyl Turntable', icon: '💿', desc: 'Cinematic rotating vinyl grooves & spindle light', genre: 'Lo-Fi, Classic' },
  { id: 'eclipse-corona', name: 'Eclipse Corona', icon: '🌑', desc: 'Dark moon eclipse with pulsating solar corona', genre: 'Introspective, Dark Pop' },
  { id: 'snowfall-quiet', name: 'Snowfall Quiet', icon: '❄️', desc: 'Multi-depth drifting snowflakes & crystal mist', genre: 'Piano, Sad Ballad' },
  { id: 'prism-kaleidoscope', name: 'Prism Kaleidoscope', icon: '💎', desc: 'Radial kaleidoscopic symmetry & crystal facets', genre: 'Anime OP, Energetic' },
  { id: 'radar-sonar', name: 'Radar Sonar', icon: '📡', desc: 'Concentric sonar pings & rotating radar sweep', genre: 'Minimalist, Experimental' },
  { id: 'golden-dust-rays', name: 'Golden Dust Rays', icon: '☀️', desc: 'Diagonal sunbeams & floating golden dust specks', genre: 'Uplifting, Hopeful' },
];

export const SCENE_REGISTRY = {
  'kinetic-prism': renderKineticPrismScene,
  'rain-mist': renderRainMistScene,
  'ember-storm': renderEmberStormScene,
  'celestial-drift': renderCelestialDriftScene,
  'analog-wave': renderAnalogWaveScene,
  'editorial-silk': renderEditorialSilkScene,
  'sakura-petals': renderSakuraPetalsScene,
  'aurora-curtain': renderAuroraCurtainScene,
  'monolith-bars': renderMonolithBarsScene,
  'liquid-horizon': renderLiquidHorizonScene,
  'cyber-grid': renderCyberGridScene,
  'firefly-meadow': renderFireflyMeadowScene,
  'vinyl-turntable': renderVinylTurntableScene,
  'eclipse-corona': renderEclipseCoronaScene,
  'snowfall-quiet': renderSnowfallQuietScene,
  'prism-kaleidoscope': renderPrismKaleidoscopeScene,
  'radar-sonar': renderRadarSonarScene,
  'golden-dust-rays': renderGoldenDustRaysScene,
};

/**
 * Dispatch rendering to one of 18 distinct 2D cinematic scene archetypes
 */
export function renderSceneArchetype(sceneId, ctx, width, height, params) {
  const renderer = SCENE_REGISTRY[sceneId] || renderEditorialSilkScene;
  renderer(ctx, width, height, params);
}

/**
 * Automatically resolve 1 of 18 scene archetypes based on song metadata, tempo, and audio dynamics
 */
export function resolve2DSceneArchetype(trackMeta, liveAudioDynamics = {}) {
  const id = String(trackMeta?.id || '').toLowerCase();
  const genre = String(trackMeta?.genre || '').toLowerCase();
  const title = String(trackMeta?.title || '').toLowerCase();
  const style = String(trackMeta?.particleStyle || '').toLowerCase();
  const energy = String(trackMeta?.visualEnergy || '').toLowerCase();
  const pace = Number(liveAudioDynamics?.paceFactor || 1.0);

  // 1. Kinetic Prism: J-Pop, Tokusatsu, Ska, High-Tempo, Laser
  if (
    id.includes('candy-blaze') ||
    id.includes('w-b-x') ||
    id.includes('everything-u-are') ||
    genre.includes('tokusatsu') ||
    genre.includes('j-pop') ||
    genre.includes('j-rock') ||
    genre.includes('ska') ||
    genre.includes('speed') ||
    title.includes('kamen rider') ||
    title.includes('blaze') ||
    (energy === 'intense' && pace >= 1.25)
  ) {
    return 'kinetic-prism';
  }

  // 2. Cyber Grid: Electronic, Synth-Pop, Synthwave, Techno, Cyber
  if (
    genre.includes('synth-pop') ||
    genre.includes('synthwave') ||
    genre.includes('electronic') ||
    genre.includes('hyperpop') ||
    genre.includes('dance') ||
    genre.includes('cyber') ||
    genre.includes('techno') ||
    genre.includes('electro') ||
    title.includes('cyber') ||
    title.includes('future') ||
    style === 'cyber-grid'
  ) {
    return 'cyber-grid';
  }

  // 3. Prism Kaleidoscope: Anime, Energetic, Kaleidoscope, Crystal
  if (
    genre.includes('anime') ||
    genre.includes('energetic') ||
    title.includes('kaleidoscope') ||
    title.includes('kristal') ||
    title.includes('prism') ||
    style === 'prism-kaleidoscope'
  ) {
    return 'prism-kaleidoscope';
  }

  // 4. Ember Storm: Post-Rock, Emo, Stoner Rock, Alt-Rock, Grunge, Metal
  if (
    id.includes('penyangkalan') ||
    id.includes('sadrah') ||
    id.includes('tarot') ||
    id.includes('duka') ||
    style === 'falling-ash' ||
    style === 'ember-sparks' ||
    style === 'storm-lightning' ||
    genre.includes('post-rock') ||
    genre.includes('emo') ||
    genre.includes('stoner') ||
    genre.includes('alt-rock') ||
    genre.includes('hardcore') ||
    genre.includes('metal') ||
    genre.includes('grunge') ||
    genre.includes('punk') ||
    genre.includes('rock')
  ) {
    return 'ember-storm';
  }

  // 5. Monolith Bars: Heavy, Post-Hardcore, Heavy Bass, Dramatic
  if (
    genre.includes('post-hardcore') ||
    genre.includes('monolith') ||
    genre.includes('pillar') ||
    genre.includes('heavy') ||
    title.includes('monolith') ||
    title.includes('pilar') ||
    style === 'monolith-bars'
  ) {
    return 'monolith-bars';
  }

  // 6. Analog Wave: Retro Pop, Soul, Funk, Vintage
  if (
    id.includes('lantas') ||
    id.includes('bunga-maaf') ||
    id.includes('sialan') ||
    genre.includes('retro') ||
    genre.includes('soul') ||
    genre.includes('city pop') ||
    genre.includes('funk') ||
    genre.includes('vintage') ||
    genre.includes('cassette') ||
    style === 'film-noir-dust' ||
    style === 'sunflare-vintage'
  ) {
    return 'analog-wave';
  }

  // 7. Vinyl Turntable: Lo-Fi, Classic, Gramophone, Vinyl
  if (
    genre.includes('lo-fi') ||
    genre.includes('lofi') ||
    genre.includes('vinyl') ||
    genre.includes('classic') ||
    genre.includes('oldies') ||
    title.includes('vinyl') ||
    title.includes('piringan') ||
    style === 'vinyl-turntable'
  ) {
    return 'vinyl-turntable';
  }

  // 8. Sakura Petals: Folk, Acoustic, Nostalgia, Bunga, Spring
  if (
    genre.includes('nostalgia') ||
    title.includes('sakura') ||
    title.includes('bunga') ||
    title.includes('petals') ||
    title.includes('kelopak') ||
    title.includes('gugur') ||
    style === 'sakura-petals'
  ) {
    return 'sakura-petals';
  }

  // 9. Firefly Meadow: Indie Folk, Meadow, Kunang, Padang, Forest
  if (
    genre.includes('indie folk') ||
    genre.includes('meadow') ||
    title.includes('kunang') ||
    title.includes('padang') ||
    title.includes('rumput') ||
    title.includes('alam') ||
    title.includes('forest') ||
    title.includes('hutan') ||
    style === 'firefly-meadow'
  ) {
    return 'firefly-meadow';
  }

  // 10. Liquid Horizon: R&B, Romantic, Ocean, Laut, Pantai, Wave
  if (
    genre.includes('r&b') ||
    genre.includes('romantic') ||
    genre.includes('ocean') ||
    title.includes('laut') ||
    title.includes('pantai') ||
    title.includes('ombak') ||
    title.includes('samudra') ||
    title.includes('wave') ||
    title.includes('danau') ||
    style === 'liquid-horizon'
  ) {
    return 'liquid-horizon';
  }

  // 11. Eclipse Corona: Dark Pop, Introspective, Eclipse, Gerhana
  if (
    genre.includes('dark pop') ||
    genre.includes('introspective') ||
    genre.includes('dark') ||
    title.includes('gerhana') ||
    title.includes('eclipse') ||
    title.includes('bayang') ||
    title.includes('shadow') ||
    style === 'eclipse-corona'
  ) {
    return 'eclipse-corona';
  }

  // 12. Snowfall Quiet: Piano, Salju, Dingin, Winter, Snow
  if (
    genre.includes('piano') ||
    genre.includes('winter') ||
    title.includes('salju') ||
    title.includes('snow') ||
    title.includes('dingin') ||
    title.includes('winter') ||
    style === 'snowfall-quiet'
  ) {
    return 'snowfall-quiet';
  }

  // 13. Radar Sonar: Minimalist, Experimental, Sonar, Radar
  if (
    genre.includes('minimalist') ||
    genre.includes('experimental') ||
    genre.includes('sonar') ||
    title.includes('radar') ||
    title.includes('sonar') ||
    title.includes('sinyal') ||
    style === 'radar-sonar'
  ) {
    return 'radar-sonar';
  }

  // 14. Golden Dust Rays: Uplifting, Hopeful, Sunrise, Fajar, Golden
  if (
    genre.includes('uplifting') ||
    genre.includes('hopeful') ||
    genre.includes('golden') ||
    title.includes('fajar') ||
    title.includes('mentari') ||
    title.includes('pagi') ||
    title.includes('golden') ||
    title.includes('sun') ||
    style === 'golden-dust-rays'
  ) {
    return 'golden-dust-rays';
  }

  // 15. Aurora Curtain: Ambient, Ethereal, Cahaya, Langit
  if (
    genre.includes('ambient') ||
    genre.includes('ethereal') ||
    title.includes('aurora') ||
    title.includes('tirai') ||
    title.includes('langit malam') ||
    style === 'aurora-curtain'
  ) {
    return 'aurora-curtain';
  }

  // 16. Celestial Drift: Indie Pop, Dreamy, Space, Bintang
  if (
    id.includes('cincin') ||
    id.includes('bersamamu') ||
    genre.includes('dream') ||
    genre.includes('indie pop') ||
    genre.includes('space') ||
    genre.includes('shoegaze') ||
    title.includes('bintang') ||
    title.includes('star') ||
    title.includes('langit') ||
    style === 'stardust'
  ) {
    return 'celestial-drift';
  }

  // 17. Rain Mist: Folk, Acoustic, Ballad, Melancholy, Gerimis, Hujan
  if (
    id.includes('kini') ||
    id.includes('resah-jadi-luka') ||
    id.includes('tuk-singgah') ||
    id.includes('terima-kasih') ||
    style === 'rain' ||
    style === 'heavy-rain' ||
    style === 'midnight-mist' ||
    genre.includes('folk') ||
    genre.includes('acoustic') ||
    genre.includes('melancholy') ||
    genre.includes('gerimis') ||
    genre.includes('hujan') ||
    genre.includes('sad') ||
    title.includes('kini') ||
    title.includes('hujan') ||
    title.includes('gerimis') ||
    title.includes('luka')
  ) {
    return 'rain-mist';
  }

  // 18. Editorial Silk: Orchestral, Dramatic Ballad, & Fallback
  return 'editorial-silk';
}
