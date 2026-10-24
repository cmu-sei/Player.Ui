// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, expect, it } from 'vitest';
import { reflectComponentType, Type } from '@angular/core';
import { Route, Routes } from '@angular/router';
import { firstValueFrom, isObservable, Observable } from 'rxjs';
import { ROUTES } from './app.routes';

/** Runs a route loader and unwraps its result, which can be a value, a promise or an observable, and a default export. */
async function load(loader: () => unknown): Promise<unknown> {
  const result = loader();
  const loaded = isObservable(result)
    ? await firstValueFrom(result as Observable<unknown>)
    : await result;
  return loaded && typeof loaded === 'object' && 'default' in loaded
    ? loaded.default
    : loaded;
}

/** Every route with a lazy loader, including children and lazily loaded child routes, keyed by full path. */
async function lazyRoutes(
  routes: Routes,
  prefix = '',
): Promise<[string, Route][]> {
  const found: [string, Route][] = [];
  for (const route of routes) {
    const path = `${prefix}/${route.path ?? ''}`;
    if (route.loadComponent || route.loadChildren) {
      found.push([path, route]);
    }
    if (route.children) {
      found.push(...(await lazyRoutes(route.children, path)));
    }
    if (route.loadChildren) {
      const children = await load(route.loadChildren);
      if (Array.isArray(children)) {
        found.push(...(await lazyRoutes(children, path)));
      }
    }
  }
  return found;
}

describe('app routes', () => {
  /**
   * Verifies: every lazy route loads: each loadComponent resolves to a component and each loadChildren to routes or an NgModule. The router only calls these when someone navigates, so a missing or renamed export would otherwise only fail in the browser.
   * Interacts with: the loadComponent and loadChildren functions of the app's route table.
   * Data: all routes in ROUTES, nested and lazily loaded child routes included.
   */
  it('loads every lazy route', async () => {
    const lazy = await lazyRoutes(ROUTES);
    expect(lazy.length).toBeGreaterThan(0);
    for (const [path, route] of lazy) {
      if (route.loadComponent) {
        const component = await load(route.loadComponent);
        expect(
          reflectComponentType(component as Type<unknown>),
          path,
        ).not.toBeNull();
      } else {
        const children = await load(route.loadChildren!);
        expect(
          Array.isArray(children) || typeof children === 'function',
          path,
        ).toBe(true);
      }
    }
  });
});
