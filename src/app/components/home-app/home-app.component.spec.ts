// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { HomeAppComponent } from './home-app.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { TopbarView } from '../shared/top-bar/topbar.models';
import { TopbarComponent } from '../shared/top-bar/topbar.component';
import { ViewListComponent } from './view-list/view-list.component';

@Component({ selector: 'app-topbar', template: '' })
class TopbarStubComponent {
  readonly title = input<string>();
  readonly topbarView = input<TopbarView>();
}

@Component({ selector: 'app-view-list', template: '' })
class ViewListStubComponent {}

// The test DOM never loads images, so tests fire load or error themselves.
class FakeImage {
  static last: FakeImage | undefined;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  constructor() {
    FakeImage.last = this;
  }
}

async function renderHome(overrides: { appTopBarText?: string; background?: string } = {}) {
  const { appTopBarText = 'Player', background } = overrides;

  return renderComponent(HomeAppComponent, {
    childStubs: [
      { replace: TopbarComponent, with: TopbarStubComponent },
      { replace: ViewListComponent, with: ViewListStubComponent },
    ],
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

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeImage.last = undefined;
  });

  /**
   * Verifies: the page shows the background image named in settings once it loads.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, HomeAppComponent template.
   * Data: AppLandingBackgroundImage set to a relative asset URL; the image load event fires.
   */
  it('shows the landing background once the image loads', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderHome({ background: '/assets/local/landing-background.jpg' });

    expect(FakeImage.last?.src).toBe('/assets/local/landing-background.jpg');
    FakeImage.last!.onload!();
    fixture.detectChanges();

    const page = container.querySelector('.container') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe('url("/assets/local/landing-background.jpg")');
    expect(page.classList.contains('has-background')).toBe(true);
  });

  /**
   * Verifies: an image that fails to load leaves the normal page background, as if unset.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, HomeAppComponent template.
   * Data: AppLandingBackgroundImage set to a missing image; the image error event fires.
   */
  it('keeps the normal background when the image fails to load', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderHome({ background: '/assets/local/missing.jpg' });

    FakeImage.last!.onerror?.();
    fixture.detectChanges();

    const page = container.querySelector('.container') as HTMLElement;
    expect(page.style.getPropertyValue('--landing-background')).toBe('');
    expect(page.classList.contains('has-background')).toBe(false);
  });

  /**
   * Verifies: without the setting, no image is requested and the normal page background is kept.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, HomeAppComponent template.
   * Data: AppLandingBackgroundImage unset.
   */
  it('keeps the normal background without the setting', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { container } = await renderHome();

    expect(FakeImage.last).toBeUndefined();
    const page = container.querySelector('.container') as HTMLElement;
    expect(page.classList.contains('has-background')).toBe(false);
  });
});
