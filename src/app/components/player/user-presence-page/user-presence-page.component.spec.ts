// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { UserPresencePageComponent } from './user-presence-page.component';
import { renderComponent } from '../../../test-utils/render-component';

@Component({ selector: 'app-user-presence', template: '' })
class UserPresenceStubComponent {
  @Input() viewId!: string;
}

async function renderPage(overrides: { viewId?: string | null } = {}) {
  const { viewId = 'view-1' } = overrides;
  return renderComponent(UserPresencePageComponent, {
    imports: [UserPresenceStubComponent],
    declarations: [UserPresencePageComponent],
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
  /**
   * Verifies: init reads the 'id' route param into the component's viewId and the template forwards it
   *   to the presence child.
   * Interacts with: RouterQuery.getParams stub, component viewId, the UserPresenceStubComponent standing
   *   in for app-user-presence.
   * Data: renderPage override viewId 'my-view'.
   * Why: the page's only job is to route the id through to the child, so the value that arrived at the
   *   child is the behavior worth pinning — the [viewId] binding could be dropped entirely and a check of
   *   the page's own field would still pass.
   */
  it('reads the viewId from the router query and passes it to the presence child', async () => {
    const { fixture } = await renderPage({ viewId: 'my-view' });
    expect(fixture.componentInstance.viewId).toBe('my-view');
    const presence = fixture.debugElement.query(
      By.directive(UserPresenceStubComponent),
    ).componentInstance as UserPresenceStubComponent;
    expect(presence.viewId).toBe('my-view');
  });

  /**
   * Verifies: a null route id is tolerated, leaving viewId null without error.
   * Interacts with: RouterQuery.getParams stub returning null, component viewId.
   * Data: renderPage override viewId null.
   */
  it('handles a null view id without throwing', async () => {
    const { fixture } = await renderPage({ viewId: null });
    expect(fixture.componentInstance.viewId).toBeNull();
  });
});
