// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { HomeAppComponent } from './home-app.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { TopbarView } from '../shared/top-bar/topbar.models';

@Component({ selector: 'app-topbar', template: '' })
class TopbarStubComponent {
  readonly title = input<string>();
  readonly topbarView = input<TopbarView>();
}

@Component({ selector: 'app-view-list', template: '' })
class ViewListStubComponent {}

async function renderHome(overrides: { appTopBarText?: string } = {}) {
  const { appTopBarText = 'Player' } = overrides;

  return renderComponent(HomeAppComponent, {
    declarations: [HomeAppComponent],
    imports: [TopbarStubComponent, ViewListStubComponent],
    providers: [
      {
        provide: ComnSettingsService,
        useValue: {
          settings: {
            ApiUrl: '',
            AppTopBarText: appTopBarText,
            AppTopBarHexColor: '#0F1D47',
            AppTopBarHexTextColor: '#FFFFFF',
          },
        },
      },
    ],
  });
}

describe('HomeAppComponent', () => {
  /**
   * Verifies: the app-topbar element is rendered in the template.
   * Interacts with: rendered DOM via document.querySelector.
   * Data: default renderHome() settings.
   * Why: app-topbar is replaced by a local stub component, so the assertion
   *       queries the element by selector rather than any topbar content.
   */
  it('should display topbar', async () => {
    await renderHome();
    const container = document.querySelector('app-topbar');
    expect(container).toBeTruthy();
  });

  /**
   * Verifies: component.title is populated from the AppTopBarText setting.
   * Interacts with: ComnSettingsService stub, component instance.
   * Data: renderHome() override appTopBarText 'My Player'.
   */
  it('should set title from settings', async () => {
    const { fixture } = await renderHome({ appTopBarText: 'My Player' });
    expect(fixture.componentInstance.title).toBe('My Player');
  });

  /**
   * Verifies: the app-view-list child component is present in the template.
   * Interacts with: rendered DOM via document.querySelector.
   * Data: default renderHome() settings.
   */
  it('should show view list component', async () => {
    await renderHome();
    const viewList = document.querySelector('app-view-list');
    expect(viewList).toBeTruthy();
  });

  /**
   * Verifies: the template hands the topbar the settings-derived title and the PLAYER_HOME view.
   * Interacts with: the TopbarStubComponent standing in for app-topbar, read through its signal inputs.
   * Data: renderHome() override appTopBarText 'My Player'.
   * Why: reading the values that actually arrived at the child is what pins the two template bindings —
   *   asserting the component's own TopbarView enum reference passes no matter which member the template
   *   binds, or whether it binds one at all.
   */
  it('should pass the title and PLAYER_HOME topbar view to the topbar', async () => {
    const { fixture } = await renderHome({ appTopBarText: 'My Player' });
    const topbar = fixture.debugElement.query(By.directive(TopbarStubComponent))
      .componentInstance as TopbarStubComponent;
    expect(topbar.title()).toBe('My Player');
    expect(topbar.topbarView()).toBe(TopbarView.PLAYER_HOME);
  });
});
