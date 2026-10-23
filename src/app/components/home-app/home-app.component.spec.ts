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

async function renderHome(overrides: { appTopBarText?: string; background?: string } = {}) {
  const { appTopBarText = 'Player', background } = overrides;

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
            AppLandingBackgroundImage: background,
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
   */
  it('should pass the title and PLAYER_HOME topbar view to the topbar', async () => {
    const { fixture } = await renderHome({ appTopBarText: 'My Player' });
    const topbar = fixture.debugElement.query(By.directive(TopbarStubComponent))
      .componentInstance as TopbarStubComponent;
    expect(topbar.title()).toBe('My Player');
    expect(topbar.topbarView()).toBe(TopbarView.PLAYER_HOME);
  });

  /**
   * Verifies: the page shows the background image named in settings, and none without the setting.
   * Interacts with: ComnSettingsService.settings (stub), HomeAppComponent template.
   * Data: AppLandingBackgroundImage set to a relative asset URL, or unset.
   */
  it.each([
    { label: 'with', background: '/assets/local/landing-background.jpg', expected: 'url("/assets/local/landing-background.jpg")' },
    { label: 'without', background: undefined, expected: '' },
  ])('shows the landing background $label the setting', async ({ background, expected }) => {
    const { container } = await renderHome({ background });

    const page = container.querySelector('.container') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe(expected);
    expect(page.classList.contains('has-background')).toBe(!!background);
  });
});
