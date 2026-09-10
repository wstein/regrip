import { byId } from './dom';

/**
 * Wire the fullscreen toggle button. It maximises the whole lab via the
 * Fullscreen API; the button removes itself where the API is unavailable
 * (for example a jsdom test or a sandboxed frame without `allow="fullscreen"`).
 */
export function mountFullscreenToggle(id = 'fullscreen'): void {
  const button = byId<HTMLButtonElement>(id);
  if (!document.fullscreenEnabled) {
    button.remove();
    return;
  }
  const target = document.documentElement;

  const render = (): void => {
    const active = document.fullscreenElement !== null;
    button.textContent = active ? '⛶ Exit fullscreen' : '⛶ Fullscreen';
    button.setAttribute('aria-pressed', String(active));
  };

  button.addEventListener('click', () => {
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : target.requestFullscreen();
    void request.catch((error: unknown) => console.error('fullscreen toggle failed', error));
  });
  document.addEventListener('fullscreenchange', render);
  render();
}
