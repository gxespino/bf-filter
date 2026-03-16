const ATTR_FILTERED = 'data-bf-filtered';
const ATTR_ORIGINAL_DISPLAY = 'data-bf-original-display';
const REVEALED_CLASS = 'bf-filter-revealed';
const SUMMARY_BAR_ID = 'bf-filter-summary';

export class DomManipulator {
  private filteredCount = 0;
  private revealed = false;
  private summaryBar: HTMLElement | null = null;

  getFilteredCount(): number {
    return this.filteredCount;
  }

  applyFilter(element: HTMLElement, reason?: string): void {
    if (element.hasAttribute(ATTR_FILTERED)) return;

    this.filteredCount++;
    element.setAttribute(ATTR_ORIGINAL_DISPLAY, element.style.display);
    element.setAttribute(ATTR_FILTERED, reason || 'filtered');
    element.style.display = 'none';

    this.updateSummaryBar();
  }

  removeAllFilters(): void {
    document
      .querySelectorAll(`[${ATTR_FILTERED}]`)
      .forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = htmlEl.getAttribute(ATTR_ORIGINAL_DISPLAY) || '';
        htmlEl.removeAttribute(ATTR_ORIGINAL_DISPLAY);
        htmlEl.removeAttribute(ATTR_FILTERED);
        htmlEl.classList.remove(REVEALED_CLASS);
      });
    this.filteredCount = 0;
    this.revealed = false;
    this.removeSummaryBar();
  }

  private toggleReveal(): void {
    this.revealed = !this.revealed;
    document.querySelectorAll(`[${ATTR_FILTERED}]`).forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (this.revealed) {
        htmlEl.style.display = htmlEl.getAttribute(ATTR_ORIGINAL_DISPLAY) || '';
        htmlEl.classList.add(REVEALED_CLASS);
      } else {
        htmlEl.style.display = 'none';
        htmlEl.classList.remove(REVEALED_CLASS);
      }
    });
    this.updateSummaryBarText();
  }

  private updateSummaryBar(): void {
    if (this.filteredCount === 0) {
      this.removeSummaryBar();
      return;
    }

    if (!this.summaryBar) {
      this.summaryBar = document.createElement('div');
      this.summaryBar.id = SUMMARY_BAR_ID;
      this.summaryBar.addEventListener('click', () => this.toggleReveal());

      // Find the <ol> that actually contains comments, not a random <ol> in the post body
      const commentOl = document.querySelector('ol:has(div[id^="comment-"])');
      if (commentOl) {
        commentOl.parentElement?.insertBefore(this.summaryBar, commentOl);
      }
    }

    this.updateSummaryBarText();
  }

  private updateSummaryBarText(): void {
    if (!this.summaryBar) return;
    const noun = this.filteredCount === 1 ? 'comment' : 'comments';
    this.summaryBar.textContent = this.revealed
      ? `Hiding ${this.filteredCount} filtered ${noun}`
      : `Show ${this.filteredCount} filtered ${noun}`;
  }

  private removeSummaryBar(): void {
    this.summaryBar?.remove();
    this.summaryBar = null;
  }
}
