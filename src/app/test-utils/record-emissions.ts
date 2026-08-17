// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { onTestFinished } from 'vitest';
import { Observable } from 'rxjs';

export function recordEmissions<T>(source: Observable<T>): T[] {
  const seen: T[] = [];
  const subscription = source.subscribe((value) =>
    seen.push(structuredClone(value)),
  );
  onTestFinished(() => subscription.unsubscribe());
  return seen;
}
