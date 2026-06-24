// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { HomeAppComponent } from './home-app.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { TopbarView } from '../shared/top-bar/topbar.models';

async function renderHome(overrides: { appTopBarText?: string } = {}) {
  const { appTopBarText = 'Player' } = overrides;

  return renderComponent(HomeAppComponent, {
    declarations: [HomeAppComponent],
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
   * Verifies: HomeAppComponent instantiates successfully.
   * Interacts with: renderHome harness with ComnSettingsService stub.
   * Data: default renderHome() settings.
   */
  it('should create', async () => {
    const { fixture } = await renderHome();
    expect(fixture.componentInstance).toBeTruthy();
  });

  /**
   * Verifies: the app-topbar custom element is rendered in the template.
   * Interacts with: rendered DOM via document.querySelector.
   * Data: default renderHome() settings.
   * Why: queries the custom element name directly because CUSTOM_ELEMENTS_SCHEMA keeps
   *       app-topbar unresolved in the test harness.
   */
  it('should display topbar', async () => {
    await renderHome();
    // The topbar is rendered as a custom element (app-topbar) due to CUSTOM_ELEMENTS_SCHEMA
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
   * Verifies: component exposes the TopbarView enum and its PLAYER_HOME value resolves to 'player-home'.
   * Interacts with: component instance, imported TopbarView enum.
   * Data: default renderHome() settings.
   */
  it('should pass PLAYER_HOME topbar view', async () => {
    const { fixture } = await renderHome();
    // The component exposes TopbarView enum and the template binds TopbarView.PLAYER_HOME
    expect(fixture.componentInstance.TopbarView).toBe(TopbarView);
    expect(fixture.componentInstance.TopbarView.PLAYER_HOME).toBe(
      'player-home',
    );
  });
});
