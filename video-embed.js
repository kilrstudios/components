class KilrVideoEmbed {
    static VERSION = '1.0.0';  // Major.Minor.Patch version

    constructor(container) {
        this.container = container;
        this.player = null;
        this.isPlayerReady = false;
        this.captionLinks = container.querySelectorAll('[kilr-video-embed="caption-link"]');
        this.playerContainer = container.querySelector('[kilr-video-embed="player"]');
        this.playerIframe = this.playerContainer.querySelector('iframe');
        this.activeCaption = null;
        this.pendingSeek = null;
        
        this.loadYouTubeAPI();
        this.bindCaptionLinks();
    }

    loadYouTubeAPI() {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                this.initializePlayer();
            }
        } else {
            this.initializePlayer();
        }
    }

    injectCustomStyles() {
        const customStyles = document.createElement('style');
        customStyles.textContent = `
            .ytp-show-cards-title, 
            .ytp-right-controls, 
            .ytp-pause-overlay-container {
                display: none !important;
            }
        `;
        document.head.appendChild(customStyles);
    }

    initializePlayer() {
        try {
            const videoSrc = this.playerIframe.src;
            const videoIdMatch = videoSrc.match(/embed\/([^?]+)/);
            if (!videoIdMatch) return;
            
            const videoId = videoIdMatch[1];
            const newContainer = document.createElement('div');
            newContainer.id = 'youtube-player-' + Math.random().toString(36).substr(2, 9);
            this.playerIframe.parentNode.replaceChild(newContainer, this.playerIframe);

            this.injectCustomStyles();

            this.player = new YT.Player(newContainer.id, {
                videoId: videoId,
                height: '100%',
                width: '100%',
                events: {
                    'onReady': (event) => {
                        this.isPlayerReady = true;
                        if (this.pendingSeek !== null) {
                            this.seekTo(this.pendingSeek);
                            this.pendingSeek = null;
                        }
                    },
                    'onStateChange': this.onPlayerStateChange.bind(this),
                    'onError': () => {}
                },
                playerVars: {
                    modestbranding: 1,
                    controls: 1,
                    showinfo: 0,
                    rel: 0,
                    iv_load_policy: 3,
                    fs: 1,
                    playsinline: 1,
                    disablekb: 0,
                    origin: window.location.origin
                }
            });
        } catch (error) {
            // Silent error handling
        }
    }

    timeCodeToSeconds(timeCode) {
        const seconds = parseFloat(timeCode);
        if (!isNaN(seconds)) {
            return seconds;
        }
        
        const [minutes, secs] = timeCode.split(':').map(Number);
        return minutes * 60 + secs;
    }

    seekTo(seconds) {
        if (!this.isPlayerReady || !this.player || !this.player.seekTo) {
            this.pendingSeek = seconds;
            return;
        }
        
        setTimeout(() => {
            try {
                this.player.seekTo(seconds, true);
                this.player.playVideo();
                this.updateActiveCaption(seconds);
            } catch (error) {
                // Silent error handling
            }
        }, 100);
    }

    bindCaptionLinks() {
        this.captionLinks.forEach((link) => {
            link.addEventListener('click', () => {
                const timeCode = link.getAttribute('data-timecode');
                const seconds = this.timeCodeToSeconds(timeCode);
                this.seekTo(seconds);
                this.setActiveCaption(link);
            });
        });
    }

    setActiveCaption(newActiveCaption) {
        this.captionLinks.forEach(link => {
            link.classList.remove('is-active');
        });

        if (newActiveCaption) {
            newActiveCaption.classList.add('is-active');
            this.activeCaption = newActiveCaption;
            
            const scrollContainer = newActiveCaption.closest('[kilr-video-embed="captions-links"]');
            if (scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const captionRect = newActiveCaption.getBoundingClientRect();
                const relativeTop = captionRect.top - containerRect.top + scrollContainer.scrollTop;
                
                scrollContainer.scrollTo({
                    top: relativeTop,
                    behavior: 'smooth'
                });
            }
        }
    }

    updateActiveCaption(currentTime) {
        let newActiveCaption = null;
        let lastTimecode = -1;

        this.captionLinks.forEach(link => {
            const timeCode = link.getAttribute('data-timecode');
            const seconds = this.timeCodeToSeconds(timeCode);
            
            if (seconds <= (currentTime + 0.1) && seconds > lastTimecode) {
                lastTimecode = seconds;
                newActiveCaption = link;
            }
        });

        if (newActiveCaption && newActiveCaption !== this.activeCaption) {
            this.setActiveCaption(newActiveCaption);
        }
    }

    onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            this.startTimeCheck();
        } else {
            this.stopTimeCheck();
        }
    }

    startTimeCheck() {
        this.stopTimeCheck();
        this.timeCheckInterval = setInterval(() => {
            if (this.player && this.player.getCurrentTime) {
                const currentTime = this.player.getCurrentTime();
                this.updateActiveCaption(currentTime);
            }
        }, 250);
    }

    stopTimeCheck() {
        if (this.timeCheckInterval) {
            clearInterval(this.timeCheckInterval);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const videoEmbeds = document.querySelectorAll('[kilr-video-embed="container"]');
    videoEmbeds.forEach(container => {
        new KilrVideoEmbed(container);
    });
});
