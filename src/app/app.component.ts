// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, HostBinding, OnDestroy } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { ComnAuthQuery, Theme, ComnSettingsService } from '@cmusei/crucible-common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnDestroy {
  @HostBinding('class') componentCssClass: string;
  theme$: Observable<Theme> = this.authQuery.userTheme$;
  unsubscribe$: Subject<null> = new Subject<null>();

  constructor(
    private iconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer,
    private overlayContainer: OverlayContainer,
    private authQuery: ComnAuthQuery,
    private settingsService: ComnSettingsService,
    private titleService: Title
  ) {
    this.theme$.pipe(takeUntil(this.unsubscribe$)).subscribe((theme) => {
      this.setTheme(theme);
    });
    this.registerIcons();

    // Set the Title for when the VM app is in it's own browser tab.
    titleService.setTitle(settingsService.settings.AppTitle);
  }

  registerIcons() {
    this.iconRegistry.addSvgIcon(
      'ic_apps_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_apps_white_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_chevron_left_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_chevron_left_white_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_chevron_right_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_chevron_right_white_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_chevron_right_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_chevron_right_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_expand_more_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_expand_more_white_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_clear_black_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_clear_black_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_expand_more_black_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_expand_more_black_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_cancel_circle',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_cancel_circle.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_back_arrow',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_back_arrow_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_magnify_search',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_magnify_glass_48px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_clipboard_copy',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_clipboard_copy.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_crucible_player',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_crucible_player.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_delete',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_delete_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_get_app',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_get_app_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_edit',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_edit_24px.svg'
      )
    );
    this.iconRegistry.addSvgIcon(
      'ic_add',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_add_24px.svg'
      )
    );
  }

  setTheme(theme: Theme) {
    const classList = this.overlayContainer.getContainerElement().classList;
    switch (theme) {
      case Theme.LIGHT:
        this.componentCssClass = theme;
        classList.add(theme);
        classList.remove(Theme.DARK);
        break;
      case Theme.DARK:
        this.componentCssClass = theme;
        classList.add(theme);
        classList.remove(Theme.LIGHT);
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
