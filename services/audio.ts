
import { Howl, Howler } from 'howler';
import { AUDIO_MANIFEST, SfxKey } from '../utils/assets';

// Global settings
Howler.autoUnlock = true; 
Howler.volume(0.6);

export type { SfxKey };

class AudioService {
    private sounds: Record<string, Howl> = {};
    private initialized = false;
    private currentBgm: Howl | null = null;
    private currentBgmKey: string | null = null;

    /**
     * Initialized all sound assets.
     * Must be called during a user interaction (click/touch).
     */
    public async init() {
        if (this.initialized) {
            if (Howler.ctx && Howler.ctx.state === 'suspended') {
                await Howler.ctx.resume();
            }
            return;
        }
        
        Object.entries(AUDIO_MANIFEST).forEach(([key, src]) => {
            const isMusic = key.startsWith('bgm_');
            this.sounds[key] = new Howl({
                src: [src],
                // We use html5: true for BOTH music and SFX in this environment. 
                // XHR (Web Audio) is blocked by many CDNs (403/CORS), but the standard 
                // <audio> tag (HTML5) is usually allowed to stream cross-origin assets.
                html5: true, 
                preload: true,
                volume: isMusic ? 0 : 0.5,
                loop: isMusic,
                onload: () => console.log(`Audio Loaded: ${key}`),
                onloaderror: (id, err) => console.warn(`Audio Load Error [${key}]:`, err),
                onplayerror: (id, err) => {
                    console.warn(`Audio Play Error [${key}]:`, err);
                    this.sounds[key].once('unlock', () => this.sounds[key].play());
                }
            });
        });
        
        if (Howler.ctx && Howler.ctx.state === 'suspended') {
            console.log("AudioService: Resuming suspended context...");
            await Howler.ctx.resume();
        }

        console.log("AudioService: Initialized successfully with context state:", Howler.ctx?.state);
        this.initialized = true;
    }

    public play(key: SfxKey | undefined, volumeScale = 1.0) {
        if (!key || !this.sounds[key]) return;
        if (!this.initialized) this.init();
        
        if (key.startsWith('bgm_')) return; 

        const sound = this.sounds[key];
        const id = sound.play();
        sound.volume(0.5 * volumeScale, id);
    }

    /**
     * Authoritative BGM management.
     */
    public playBgm(key: 'bgm_menu' | 'bgm_game', fadeDuration = 1500) {
        if (this.currentBgmKey === key && this.currentBgm?.playing()) return;
        
        if (!this.initialized) this.init();

        const nextBgm = this.sounds[key];
        if (!nextBgm) return;

        // 1. Clean up old track
        if (this.currentBgm) {
            const oldBgm = this.currentBgm;
            const oldKey = this.currentBgmKey;
            oldBgm.fade(oldBgm.volume(), 0, fadeDuration);
            setTimeout(() => {
                if (this.currentBgmKey !== oldKey) oldBgm.stop();
            }, fadeDuration + 100);
        }

        // 2. Setup new track
        this.currentBgm = nextBgm;
        this.currentBgmKey = key;
        
        const startPlay = () => {
            nextBgm.volume(0);
            nextBgm.play();
            nextBgm.fade(0, 0.4, fadeDuration);
        };

        // If not loaded, wait for it
        if (nextBgm.state() === 'loaded') {
            startPlay();
        } else {
            nextBgm.once('load', startPlay);
            if (nextBgm.state() === 'unloaded') nextBgm.load();
        }
    }

    public stopBgm() {
        if (this.currentBgm) {
            this.currentBgm.fade(this.currentBgm.volume(), 0, 500);
            setTimeout(() => {
                this.currentBgm?.stop();
                this.currentBgm = null;
                this.currentBgmKey = null;
            }, 600);
        }
    }

    public playUiClick() {
        this.play('sfx_ui_click', 0.8);
    }

    public playUiHover() {
        this.play('sfx_ui_hover', 0.6);
    }
}

export const audio = new AudioService();
