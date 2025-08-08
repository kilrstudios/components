/**
 * Modal Handler
 * Version: 1.0.7
 * Description: Handles modal windows with trigger and close functionality
 * Last Updated: ${new Date().toISOString().split('T')[0]}
 */

(function() {
    class ModalHandler {
        static VERSION = '1.0.7';

        constructor() {
            this.initializeModals();
            console.log(`ModalHandler Version ${ModalHandler.VERSION} initialized`);
        }

        initializeModals() {
            // Use event delegation for all modal interactions
            document.addEventListener('click', (event) => {
                const trigger = event.target.closest('[kilr-modal="trigger"]');
                if (trigger) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.openModal(trigger);
                }

                const closeBtn = event.target.closest('[kilr-modal="close"]');
                if (closeBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.closeModal(closeBtn);
                }

                const modalWindow = event.target.closest('[kilr-modal="window"]');
                if (modalWindow && event.target === modalWindow) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.closeModalByKey(modalWindow.getAttribute('data-modal-key'));
                }
            });
        }

        isYouTubeModal(modalWindow) {
            return modalWindow.getAttribute('data-modal-type') === 'youtube';
        }

        getYouTubeIframe(modalWindow) {
            if (!this.isYouTubeModal(modalWindow)) return null;
            return modalWindow.querySelector('iframe[src*="youtube.com"]');
        }

        playYouTubeVideo(iframe) {
            if (!iframe) return;
            // Get the current src
            let src = iframe.src;
            // Add autoplay=1 parameter if not present
            if (src.includes('?')) {
                if (!src.includes('autoplay=')) {
                    src += '&autoplay=1';
                }
            } else {
                src += '?autoplay=1';
            }
            // Update the src to force the video to play
            iframe.src = src;
        }

        pauseYouTubeVideo(iframe) {
            if (!iframe) return;
            // Store the current src
            const currentSrc = iframe.src;
            // Remove autoplay parameter if present and add pause command
            let newSrc = currentSrc.replace(/&?autoplay=1/, '');
            if (newSrc.includes('?')) {
                newSrc += '&autoplay=0';
            } else {
                newSrc += '?autoplay=0';
            }
            // Update the src to force the video to pause
            iframe.src = newSrc;
        }

        openModal(trigger) {
            const modalKey = trigger.getAttribute('data-modal-key');
            if (!modalKey) return;

            const modalWindow = document.querySelector(`[kilr-modal="window"][data-modal-key="${modalKey}"]`);
            if (modalWindow) {
                modalWindow.classList.add('is-active');
                // Only handle YouTube if this is a YouTube modal
                if (this.isYouTubeModal(modalWindow)) {
                    const youtubeIframe = this.getYouTubeIframe(modalWindow);
                    if (youtubeIframe) {
                        this.playYouTubeVideo(youtubeIframe);
                    }
                }
            }
        }

        closeModal(closeButton) {
            const modalKey = closeButton.getAttribute('data-modal-key');
            if (!modalKey) return;
            this.closeModalByKey(modalKey);
        }

        closeModalByKey(modalKey) {
            if (!modalKey) return;
            
            const modalWindow = document.querySelector(`[kilr-modal="window"][data-modal-key="${modalKey}"]`);
            if (modalWindow) {
                // Only handle YouTube if this is a YouTube modal
                if (this.isYouTubeModal(modalWindow)) {
                    const youtubeIframe = this.getYouTubeIframe(modalWindow);
                    if (youtubeIframe) {
                        this.pauseYouTubeVideo(youtubeIframe);
                    }
                }
                modalWindow.classList.remove('is-active');
            }
        }
    }

    // Initialize the modal handler
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new ModalHandler();
        });
    } else {
        new ModalHandler();
    }

    // Make ModalHandler available globally if needed
    window.ModalHandler = ModalHandler;
})();
