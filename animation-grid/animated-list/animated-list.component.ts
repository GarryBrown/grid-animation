import { animate, query, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, ElementRef, HostBinding } from '@angular/core';
import { animatedTransition } from '@app/shared/components/animation-grid/animation-engine';
import { animationFrameScheduler } from 'rxjs';
import { subscribeOn } from 'rxjs/operators';

const animationDuration = 300;

@Component({
  selector: 'app-animated-list',
  template: `
    <ng-content></ng-content>
  `,
  styleUrls: ['./animated-list.component.scss'],
  animations: [
    trigger('wtf', [transition(':increment', [query('.cell', [animate(animationDuration)], { optional: true })])]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimatedListComponent {
  @HostBinding('@wtf') generation = 0;

  constructor(private elRef: ElementRef) {}

  getHelpers = () => {
    const remEl = (elem: Element) => elem.parentElement?.removeChild(elem);
    const getItemHTMLElements: () => { curGen: HTMLElement[]; prevGen: HTMLElement[] } = () => {
      const elems: HTMLElement[] = Array.from(this.elRef.nativeElement.querySelectorAll('.cell'));
      return elems.reduce(
        (obj: { curGen: HTMLElement[]; prevGen: HTMLElement[] }, elem) => {
          if (elem.dataset.gen === `${this.generation}`) {
            obj.curGen.push(elem);
          } else if (elem.dataset.gen === `${this.generation - 1}`) {
            obj.prevGen.push(elem);
          }
          return obj;
        },
        { curGen: [], prevGen: [] }
      );
    };
    const offsetById = (map: Map<string, { offsetLeft: number; offsetTop: number }>, elem: HTMLElement) => {
      const {
        offsetLeft,
        offsetTop,
        dataset: { id = '' },
      } = elem;
      return map.set(id, { offsetLeft, offsetTop });
    };
    const elementById = (map: Map<string, HTMLElement>, elem: HTMLElement) => {
      const {
        dataset: { id = '' },
      } = elem;
      return map.set(id, elem);
    };
    return {
      getItemHTMLElements,
      offsetById,
      elementById,
      remEl,
    };
  };

  computeAndAnimate(previousValue: { id: string }[], currentValue: { id: string }[]) {
    // 0. define some useful helpers
    const { getItemHTMLElements, elementById, offsetById, remEl } = this.getHelpers();
    const offsetFromVP = 990;

    // 1. we have to figure out what was added/removed/moved
    const prevIds = previousValue.map((x) => x.id);
    const curIds = currentValue.map((x) => x.id);
    const addedIds = curIds.filter((x) => !prevIds.includes(x)).map(String);
    const removedIds = prevIds.filter((x) => !curIds.includes(x)).map(String);
    const movedIds = curIds.filter((x) => prevIds.includes(x)).map(String);

    // 2. since this fn was called from ngOnChanges the DOM changes are not
    // flushed yet, let's save offsets in order to build proper move animation
    const prevOffsets = getItemHTMLElements().curGen.reduce(offsetById, new Map());

    // 3. now update generation, it plays useless animation on every node
    // I use this trick in order to postpone DOM element removement (:leave transition)
    this.generation += 1;

    // 4. preparation is done, let's plan animation frame
    requestAnimationFrame(() => {
      // 5. this callback is fired after all changes are flushed to DOM
      // so right now we have two sets of elements: the current and previous generations.
      // Just create maps by id to simplify access
      const { curGen, prevGen } = getItemHTMLElements();
      const curElements = curGen.reduce(elementById, new Map());
      const prevElements = prevGen.reduce(elementById, new Map());

      // 6. place all prev elements with position absolute in order to free space
      prevElements.forEach((elem) => {
        const {
          style,
          dataset: { id },
        } = elem;
        const { offsetLeft, offsetTop } = prevOffsets.get(id);
        style.position = 'absolute';
        style.left = `${offsetLeft}px`;
        style.top = `${offsetTop}px`;
      });

      // 7. layout is stable now, we can collect current offsets
      const curOffsets = curGen.reduce(offsetById, new Map());

      // 8. removed elements should should have fadeout animation. All removed elements
      // exists in previous generation only. Let's animate them

      removedIds
        .map((id) => prevElements.get(id))
        .filter(Boolean)
        .forEach((elem) => {
          animatedTransition(elem, { opacity: '0' }, `${animationDuration}ms`)
            .pipe(subscribeOn(animationFrameScheduler))
            .subscribe({ complete: () => remEl(elem) });
        });

      // 9. added elements should have fadein animation. All added elements
      // exists in current generation only. Let's animate them
      addedIds
        .map((id) => curElements.get(id))
        .filter(Boolean)
        .forEach((elem) => {
          elem.style.opacity = 0;
          animatedTransition(elem, { opacity: '1' }, `${animationDuration}ms`)
            .pipe(subscribeOn(animationFrameScheduler))
            .subscribe();
        });

      // 10. finally we can create move animations
      movedIds.forEach((id) => {
        const prevElem = prevElements.get(id);
        const prevOffset = prevOffsets.get(id);
        const curElem = curElements.get(id);
        const curOffset = curOffsets.get(id);

        if (prevOffset && curElem) {
          // 11. both prevOffset and curElem exists when moving was done in viewport
          // so we have to play cool moving animation on current element
          const deltaX = prevOffset.offsetLeft - curOffset.offsetLeft;
          const deltaY = prevOffset.offsetTop - curOffset.offsetTop;

          curElem.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
          animatedTransition(curElem, { transform: `translateY(0px) translateX(0px)` }, `${animationDuration}ms`)
            .pipe(subscribeOn(animationFrameScheduler))
            .subscribe();
        } else if (curElem) {
          // fade in from bottom
          // 12. if there is no prev element then we have to mock moving animation
          curElem.style.transform = `translate(0px, ${offsetFromVP}px)`;
          animatedTransition(curElem, { transform: `translateY(0px)` }, `${animationDuration}ms`)
            .pipe(subscribeOn(animationFrameScheduler))
            .subscribe();
        } else if (prevElem) {
          // fade out to bottom
          // 13. if there is no cur element then we have to mock moving animation
          animatedTransition(prevElem, { transform: `translateY(${offsetFromVP}px)` }, `${animationDuration}ms`)
            .pipe(subscribeOn(animationFrameScheduler))
            .subscribe({ complete: () => remEl(prevElem) });
        }
      });
    });
  }
}
