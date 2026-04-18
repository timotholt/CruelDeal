
// Implements a centralized Asset Manifest for future Preloading (PixiJS)
// and current DOM rendering.

// --- Images ---
export const getCardImg = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `https://picsum.photos/200/300?random=${hash}`;
};

export const getLocationImg = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `https://picsum.photos/350/250?blur=2&random=${hash}`;
};

// --- Audio Manifest ---
export const AUDIO_MANIFEST = {
    // UI Sounds
    'sfx_ui_click': 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
    'sfx_ui_hover': 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Re-using click as common series
    'sfx_ui_navigate': 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
    'sfx_turn_start': 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3', // Re-using chime for impact
    'sfx_victory': 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
    'sfx_defeat': 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3',
    'sfx_purchase': 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',

    // Card Actions
    'sfx_card_play': 'https://assets.mixkit.co/active_storage/sfx/2044/2044-preview.mp3', 
    'sfx_card_draw': 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
    'sfx_destroy_digital': 'https://assets.mixkit.co/active_storage/sfx/2040/2040-preview.mp3', 
    
    // Specific Effects
    'sfx_deploy_soldier': 'https://assets.mixkit.co/active_storage/sfx/2044/2044-preview.mp3', 
    'sfx_equip_light': 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
    'sfx_equip_tech': 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
    'sfx_grenade_explode': 'https://assets.mixkit.co/active_storage/sfx/1699/1699-preview.mp3',
    'sfx_teleport_short': 'https://assets.mixkit.co/active_storage/sfx/222/222-preview.mp3',
    
    // Location Ambience
    'sfx_ruins_crumble': 'https://assets.mixkit.co/active_storage/sfx/2040/2040-preview.mp3',
    'sfx_power_hum': 'https://assets.mixkit.co/active_storage/sfx/2040/2040-preview.mp3',
    'sfx_space_shimmer': 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',

    // --- BGM TRACKS ---
    // Using high-reliability CDN sources for background music
    'bgm_menu': 'https://cdn.pixabay.com/audio/2022/03/10/audio_c330f69910.mp3', // Sci-fi ambient
    'bgm_game': 'https://cdn.pixabay.com/audio/2024/02/09/audio_6de44bd833.mp3'  // Cyberpunk battle
};

export type SfxKey = keyof typeof AUDIO_MANIFEST;

export const getImg = (id: number) => `https://picsum.photos/200/300?random=${id}`;
