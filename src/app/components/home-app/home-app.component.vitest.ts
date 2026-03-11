// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
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
  it('should create', async () => {
    const { fixture } = await renderHome();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display topbar', async () => {
    await renderHome();
    // The topbar is rendered as a custom element (app-topbar) due to CUSTOM_ELEMENTS_SCHEMA
    const container = document.querySelector('app-topbar');
    expect(container).toBeTruthy();
  });

  it('should set title from settings', async () => {
    const { fixture } = await renderHome({ appTopBarText: 'My Player' });
    expect(fixture.componentInstance.title).toBe('My Player');
  });

  it('should show view list component', async () => {
    await renderHome();
    const viewList = document.querySelector('app-view-list');
    expect(viewList).toBeTruthy();
  });

  it('should pass PLAYER_HOME topbar view', async () => {
    const { fixture } = await renderHome();
    // The component exposes TopbarView enum and the template binds TopbarView.PLAYER_HOME
    expect(fixture.componentInstance.TopbarView).toBe(TopbarView);
    expect(fixture.componentInstance.TopbarView.PLAYER_HOME).toBe(
      'player-home',
    );
  });
});
