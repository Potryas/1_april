const CHARACTER_CONFIG = [
  {
    id: "tsoi",
    buttonSelector: '[data-character-id="tsoi"]',
    idleSrc: "./assets/characters/Character_1/Tsoi_0_main.webp",
    singingFrames: [
      "./assets/characters/Character_1/Tsoi_1.webp",
      "./assets/characters/Character_1/Tsoi_2.webp",
      "./assets/characters/Character_1/Tsoi_3.webp",
      "./assets/characters/Character_1/Tsoi_4.webp",
    ],
    audioSrc: "./assets/audio/Character_1_Rhytm_track.ogg",
    fallbackFrameRate: 6,
    swayPhase: 0.15,
    swayAmplitude: 1,
  },
  {
    id: "july",
    buttonSelector: '[data-character-id="july"]',
    idleSrc: "./assets/characters/Character_2/July_0_main.webp",
    singingFrames: [
      "./assets/characters/Character_2/July_1.webp",
      "./assets/characters/Character_2/July_2.webp",
      "./assets/characters/Character_2/July_3.webp",
      "./assets/characters/Character_2/July_4.webp",
    ],
    audioSrc: "./assets/audio/Character_2_High_voice_track.ogg",
    fallbackFrameRate: 7.5,
    swayPhase: 1.45,
    swayAmplitude: 0.95,
  },
  {
    id: "jakl",
    buttonSelector: '[data-character-id="jakl"]',
    idleSrc: "./assets/characters/Character_3/Jakl_0_main.webp",
    singingFrames: [
      "./assets/characters/Character_3/Jakl_1.webp",
      "./assets/characters/Character_3/Jakl_2.webp",
      "./assets/characters/Character_3/Jakl_3.webp",
      "./assets/characters/Character_3/Jakl_4.webp",
      "./assets/characters/Character_3/Jakl_5.webp",
    ],
    audioSrc: "./assets/audio/Character_3_Bass_track.ogg",
    fallbackFrameRate: 6.2,
    swayPhase: 2.35,
    swayAmplitude: 1.05,
  },
  {
    id: "gavr",
    buttonSelector: '[data-character-id="gavr"]',
    idleSrc: "./assets/characters/Character_4/Gavr_0_main.webp",
    singingFrames: [
      "./assets/characters/Character_4/Gavr_1.webp",
      "./assets/characters/Character_4/Gavr_2.webp",
      "./assets/characters/Character_4/Gavr_3.webp",
    ],
    audioSrc: "./assets/audio/Character_4_Mid_voice_track.ogg",
    fallbackFrameRate: 5.8,
    swayPhase: 3.1,
    swayAmplitude: 0.9,
  },
];

const EXTRA_TRACKS = [];
const embeddedAssets = window.__CHOIR_ASSET_MAP__ || {};
const embeddedVisemes = window.__CHOIR_VISEMES__ || null;

const state = {
  context: null,
  started: false,
  loading: false,
  visemeMaps: {},
  timelineStartTime: 0,
  trackLength: 0,
  rafId: 0,
  tracks: new Map(),
  characters: new Map(),
};

function resolveAssetPath(sourcePath) {
  return embeddedAssets[sourcePath] || sourcePath;
}

async function loadVisemes() {
  if (embeddedVisemes) {
    state.visemeMaps = embeddedVisemes;
    return;
  }

  try {
    const response = await fetch("./visemes.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch visemes.json: ${response.status}`);
    }
    state.visemeMaps = await response.json();
  } catch (error) {
    console.warn("Viseme map unavailable, using fallback animation", error);
    state.visemeMaps = {};
  }
}

async function decodeBuffer(context, src) {
  const response = await fetch(resolveAssetPath(src));
  const arrayBuffer = await response.arrayBuffer();
  return context.decodeAudioData(arrayBuffer);
}

async function ensureAudio() {
  if (state.started || state.loading) {
    return;
  }

  state.loading = true;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.context = new AudioCtx();

    const allTrackConfigs = [...CHARACTER_CONFIG, ...EXTRA_TRACKS];
    const buffers = await Promise.all(
      allTrackConfigs.map((track) => decodeBuffer(state.context, track.audioSrc)),
    );

    allTrackConfigs.forEach((trackConfig, index) => {
      const gainNode = state.context.createGain();
      gainNode.gain.value = 0;
      gainNode.connect(state.context.destination);

      const sourceNode = state.context.createBufferSource();
      sourceNode.buffer = buffers[index];
      sourceNode.loop = true;
      sourceNode.connect(gainNode);

      state.trackLength = Math.max(
        state.trackLength,
        sourceNode.buffer.duration || 0,
      );

      state.tracks.set(trackConfig.id, {
        sourceNode,
        gainNode,
        duration: sourceNode.buffer.duration,
      });
    });

    const startAt = state.context.currentTime + 0.08;
    state.timelineStartTime = startAt;

    state.tracks.forEach((track) => {
      track.sourceNode.start(startAt);
    });

    state.started = true;
    startAnimationLoop();
  } catch (error) {
    console.error(error);
  } finally {
    state.loading = false;
  }
}

function currentSongTime() {
  if (!state.started || !state.context) {
    return 0;
  }

  const elapsed = state.context.currentTime - state.timelineStartTime;
  if (elapsed < 0 || !state.trackLength) {
    return 0;
  }

  return elapsed % state.trackLength;
}

function setCharacterAudio(characterId, enabled) {
  const track = state.tracks.get(characterId);
  if (!track || !state.context) {
    return;
  }

  const now = state.context.currentTime;
  const currentGain = track.gainNode.gain.value;
  track.gainNode.gain.cancelScheduledValues(now);
  track.gainNode.gain.setValueAtTime(currentGain, now);
  track.gainNode.gain.linearRampToValueAtTime(enabled ? 1 : 0, now + 0.12);
}

function resolveFrameIndex(character, songTime) {
  const visemeConfig = character.visemeConfig;
  const frameCount = character.singingFrames.length;

  if (visemeConfig?.loopDuration && visemeConfig.frames?.length) {
    const localTime = songTime % visemeConfig.loopDuration;
    const cue =
      visemeConfig.frames.find(
        (frame) => localTime >= frame.start && localTime < frame.end,
      ) || visemeConfig.frames[visemeConfig.frames.length - 1];

    return cue.frameIndex % frameCount;
  }

  return Math.floor(songTime * character.fallbackFrameRate) % frameCount;
}

function updateCharacterVisual(character, songTime) {
  const image = character.element.querySelector(".character__image");
  const targetSrc = resolveAssetPath(character.active
    ? character.singingFrames[resolveFrameIndex(character, songTime)]
    : character.idleSrc);

  if (image.dataset.currentSrc !== targetSrc) {
    image.src = targetSrc;
    image.dataset.currentSrc = targetSrc;
  }
}

function render() {
  const songTime = currentSongTime();
  state.characters.forEach((character) => {
    character.element.classList.toggle("character--active", character.active);
    character.element.setAttribute("aria-pressed", String(character.active));
    const sway = Math.sin(songTime * 4.2 + character.swayPhase) * character.swayAmplitude;
    character.element.style.setProperty("--bob-y", `${Math.sin(songTime * 3.1 + character.swayPhase) * -3.5}px`);
    character.element.style.setProperty("--bob-rotate", `${sway * 0.85}deg`);
    updateCharacterVisual(character, songTime);
  });
}

function startAnimationLoop() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
  }

  const tick = () => {
    render();
    state.rafId = requestAnimationFrame(tick);
  };

  state.rafId = requestAnimationFrame(tick);
}

function toggleCharacter(characterId) {
  const character = state.characters.get(characterId);
  if (!character) {
    return;
  }

  character.active = !character.active;
  setCharacterAudio(characterId, character.active);
  render();
}

function bindCharacters() {
  CHARACTER_CONFIG.forEach((config) => {
    const element = document.querySelector(config.buttonSelector);
    if (!element) {
      return;
    }

    const label = element.querySelector(".character__label")?.textContent || config.id;
    const characterState = {
      ...config,
      element,
      label,
      active: false,
      visemeConfig: state.visemeMaps[config.id] || null,
    };

    element.addEventListener("click", async () => {
      if (!state.started) {
        await ensureAudio();
      }
      toggleCharacter(config.id);
    });

    state.characters.set(config.id, characterState);
  });
}

window.render_game_to_text = () =>
  JSON.stringify({
    started: state.started,
    songTime: Number(currentSongTime().toFixed(2)),
    activeCharacters: [...state.characters.values()]
      .filter((character) => character.active)
      .map((character) => character.id),
    trackIds: [...state.tracks.keys()],
  });

window.advanceTime = () => {
  render();
};

async function init() {
  document.querySelectorAll("img[src]").forEach((image) => {
    const originalSrc = image.getAttribute("src");
    const resolvedSrc = resolveAssetPath(originalSrc);
    image.src = resolvedSrc;
    image.dataset.currentSrc = resolvedSrc;
  });
  await loadVisemes();
  bindCharacters();
  render();
}

init();
