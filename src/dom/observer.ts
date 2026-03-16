/**
 * Watches for dynamically added DOM nodes matching a selector.
 * Batches discoveries via requestAnimationFrame to avoid layout thrashing.
 */
export class PostObserver {
  private observer: MutationObserver;
  private pending = new Set<HTMLElement>();
  private rafId: number | null = null;
  private selector = '';

  constructor(private onNewPosts: (posts: HTMLElement[]) => void) {
    this.observer = new MutationObserver(this.handleMutations.bind(this));
  }

  start(selector: string): void {
    this.selector = selector;
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer.disconnect();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pending.clear();
  }

  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.matches?.(this.selector)) {
          this.pending.add(node);
        } else {
          const matches = node.querySelectorAll(this.selector);
          for (let i = 0; i < matches.length; i++) {
            this.pending.add(matches[i] as HTMLElement);
          }
        }
      }
    }

    if (this.pending.size > 0 && !this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.onNewPosts(Array.from(this.pending));
        this.pending.clear();
        this.rafId = null;
      });
    }
  }
}
