import { toKebabCase } from '@app/shared/components/animation-grid/utils';
import { animationFrameScheduler, fromEvent, Observable, Subject } from 'rxjs';
import { filter, observeOn, takeUntil, tap } from 'rxjs/operators';

class AnimationContext {
  private originStyle: Partial<CSSStyleDeclaration> = {};

  constructor(private el: HTMLElement, private animationStylesName: string[]) {}

  addTransition(duration: string) {
    this.setStyle(
      'transition',
      `${this.animationStylesName.map((value) => `${toKebabCase(value)} ${duration}`).join(`,`)}`
    );
  }

  resetTransition() {
    this.resetStyle('transition');
  }

  animateTo(style: Partial<CSSStyleDeclaration>): Observable<this> {
    return new Observable((subscriber) => {
      const destroy = new Subject<void>();
      fromEvent(this.el, 'transitionend')
        .pipe(
          filter((e) => e.target === e.currentTarget),
          tap(() => subscriber.next(this)),
          tap(() => subscriber.complete()),
          takeUntil(destroy)
        )
        .subscribe();

      for (const styleName of this.animationStylesName) {
        this.setStyle(styleName as any, (style as any)[styleName]);
      }

      return () => {
        destroy.next();
        destroy.complete();
      };
    });
  }

  private setStyle(styleName: keyof typeof CSSStyleDeclaration.prototype, value: any) {
    this.originStyle[styleName as any] = (this.el.style as any)[styleName];
    this.el.style[styleName as any] = value;
  }

  private resetStyle(styleName: string) {
    (this.el.style as any)[styleName] = this.originStyle[styleName as any];
  }
}

export function animatedTransition(
  targetEl: HTMLElement,
  style: Partial<CSSStyleDeclaration>,
  duration: string
): Observable<void> {
  return new Observable((subscriber) => {
    const destroy = new Subject();
    const context = new AnimationContext(targetEl, Object.keys(style));
    const resetAnimation = () => {
      context.resetTransition();
    };

    const animateTo = context.animateTo(style).pipe(
      observeOn(animationFrameScheduler),
      tap(resetAnimation),
      tap(() => subscriber.next()),
      tap(() => subscriber.complete()),
      takeUntil(destroy)
    );

    context.addTransition(duration);
    animateTo.subscribe();

    return () => {
      destroy.next();
      destroy.complete();
      resetAnimation();
    };
  });
}
