// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { UserPresencePageComponent } from './user-presence-page.component';
import { renderComponent } from '../../../test-utils/render-component';
import { UserPresenceComponent } from './user-presence/user-presence.component';
import { activatedRouteStub } from '../../../test-utils/activated-route';

@Component({ selector: 'app-user-presence', template: '' })
class UserPresenceStubComponent {
  readonly viewId = input.required<string>();
}

async function renderPage(overrides: { viewId?: string | null } = {}) {
  const { viewId = 'view-1' } = overrides;
  return renderComponent(UserPresencePageComponent, {
    imports: [UserPresenceStubComponent],
    childStubs: [
      { replace: UserPresenceComponent, with: UserPresenceStubComponent },
    ],
    providers: [
      {
        provide: ActivatedRoute,
        useValue: activatedRouteStub({}, viewId == null ? {} : { id: viewId })
          .route,
      },
    ],
  });
}

describe('UserPresencePageComponent', () => {
  /**
   * Verifies: init reads the 'id' route param into the component's viewId and the template forwards it
   *   to the presence child.
   * Interacts with: ActivatedRoute.snapshot stub, component viewId, the UserPresenceStubComponent standing
   *   in for app-user-presence.
   * Data: renderPage override viewId 'my-view'.
   */
  it('reads the viewId from the route and passes it to the presence child', async () => {
    const { fixture } = await renderPage({ viewId: 'my-view' });
    expect(fixture.componentInstance.viewId).toBe('my-view');
    const presence = fixture.debugElement.query(
      By.directive(UserPresenceStubComponent),
    ).componentInstance as UserPresenceStubComponent;
    expect(presence.viewId()).toBe('my-view');
  });

  /**
   * Verifies: a route without an id is tolerated, leaving viewId null without error.
   * Interacts with: ActivatedRoute.snapshot stub with no id, component viewId.
   * Data: renderPage override viewId null.
   */
  it('handles a null view id without throwing', async () => {
    const { fixture } = await renderPage({ viewId: null });
    expect(fixture.componentInstance.viewId).toBeNull();
  });
});
