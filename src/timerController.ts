import { Subscription, interval } from 'rxjs';
import { now } from 'smartcube-web-bluetooth';

export function createLocalTimer(setValue: (milliseconds: number) => void) {
  let subscription: Subscription | null = null;

  return {
    start(): void {
      const startedAt = now();
      subscription?.unsubscribe();
      subscription = interval(30).subscribe(() => setValue(now() - startedAt));
    },
    stop(): void {
      subscription?.unsubscribe();
      subscription = null;
    },
  };
}
