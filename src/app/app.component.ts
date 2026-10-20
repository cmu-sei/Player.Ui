// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnDestroy, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, Title } from '@angular/platform-browser';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnSettingsService,
  CrucibleThemeService,
  Theme,
  ComnHeaderBarModule,
} from '@cmusei/crucible-common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [ComnHeaderBarModule, RouterOutlet],
})
export class AppComponent implements OnDestroy {
  private iconRegistry = inject(MatIconRegistry);
  private sanitizer = inject(DomSanitizer);
  private authQuery = inject(ComnAuthQuery);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(ComnAuthService);
  private settingsService = inject(ComnSettingsService);
  private titleService = inject(Title);
  private themeService = inject(CrucibleThemeService);

  theme$: Observable<Theme> = this.authQuery.userTheme$;
  private paramTheme;
  unsubscribe$: Subject<null> = new Subject<null>();

  constructor() {
    const settingsService = this.settingsService;
    const titleService = this.titleService;

    this.theme$.pipe(takeUntil(this.unsubscribe$)).subscribe((theme) => {
      if (this.paramTheme && this.paramTheme !== theme) {
        this.router.navigate([], {
          queryParams: { theme: theme },
          queryParamsHandling: 'merge',
        });
      }
      this.setTheme(theme);
    });
    this.activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        const theme = params.get('theme');
        if (theme != null) {
          this.paramTheme = theme === Theme.DARK ? Theme.DARK : Theme.LIGHT;
          this.authService.setUserTheme(this.paramTheme);
        }
      });
    this.registerIcons();

    // Set the Title for when the VM app is in it's own browser tab.
    titleService.setTitle(settingsService.settings.AppTitle);
  }

  registerIcons() {
    this.iconRegistry.setDefaultFontSetClass('mdi');

    this.iconRegistry.addSvgIcon(
      'ic_apps_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_apps_white_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_chevron_left_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_chevron_left_white_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_chevron_right_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_chevron_right_white_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_chevron_right_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_chevron_right_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_expand_more_white_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_expand_more_white_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_clear_black_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_clear_black_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_expand_more_black_24px',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_expand_more_black_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_cancel_circle',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_cancel_circle.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_back_arrow',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_back_arrow_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_magnify_search',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_magnify_glass_48px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_clipboard_copy',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_clipboard_copy.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_crucible_player',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_crucible_player.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_delete',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_delete_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_get_app',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_get_app_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_edit',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_edit_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_add',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_add_24px.svg',
      ),
    );
    this.iconRegistry.addSvgIcon(
      'ic_open_tab',
      this.sanitizer.bypassSecurityTrustResourceUrl(
        'assets/svg-icons/ic_open_tab.svg',
      ),
    );
  }

  setTheme(theme: Theme) {
    this.themeService.applyTheme(theme);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
