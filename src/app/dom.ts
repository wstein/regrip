/** Resolve a required app element with one consistent failure message. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing element #${id}`);
  return element as T;
}

type DropdownMenuOptions = {
  toggle?: HTMLElement;
  menu: HTMLElement;
  onClose?: () => void;
};

/** Shared open/close behavior for toggle menus and contextual popovers. */
export function createDropdownMenu({ toggle, menu, onClose }: DropdownMenuOptions) {
  const setOpen = (open: boolean): void => {
    if (menu.hidden === !open) return;
    menu.hidden = !open;
    toggle?.setAttribute('aria-expanded', String(open));
    if (!open) onClose?.();
  };
  const open = (): void => setOpen(true);
  const close = (): void => setOpen(false);
  const toggleMenu = (): void => setOpen(menu.hidden);
  const onToggle = (): void => toggleMenu();
  const onDocumentClick = (event: MouseEvent): void => {
    const target = event.target;
    if (
      menu.hidden ||
      !(target instanceof Node) ||
      menu.contains(target) ||
      toggle?.contains(target)
    ) {
      return;
    }
    close();
  };
  const onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || menu.hidden) return;
    close();
    toggle?.focus();
  };

  toggle?.addEventListener('click', onToggle);
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);

  return {
    open,
    close,
    toggle: toggleMenu,
    destroy(): void {
      toggle?.removeEventListener('click', onToggle);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeydown);
    },
  };
}
