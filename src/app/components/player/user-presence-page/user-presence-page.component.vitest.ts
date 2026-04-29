// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { UserPresencePageComponent } from './user-presence-page.component';
import { renderComponent } from '../../../test-utils/render-component';

async function renderPage(overrides: { viewId?: string | null } = {}) {
  const { viewId = 'view-1' } = overrides;
  return renderComponent(UserPresencePageComponent, {
    declarations: [UserPresencePageComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      {
        provide: RouterQuery,
        useValue: {
          getParams: (k: string) => (k === 'id' ? viewId : null),
        },
      },
    ],
  });
}

describe('UserPresencePageComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderPage();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('reads the viewId from the router query on init', async () => {
    const { fixture } = await renderPage({ viewId: 'my-view' });
    expect(fixture.componentInstance.viewId).toBe('my-view');
  });

  it('handles a null view id without throwing', async () => {
    const { fixture } = await renderPage({ viewId: null });
    expect(fixture.componentInstance.viewId).toBeNull();
  });
});
