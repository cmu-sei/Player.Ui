// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AdminAppComponent, Section } from './admin-app.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';
import { SystemPermission } from '../../generated/player-api';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

@Component({ selector: 'app-topbar', template: '' })
class TopbarStubComponent {
  readonly topbarView = input<string>();
  readonly title = input<string>();
}

@Component({ selector: 'app-admin-view-search', template: '' })
class AdminViewSearchStubComponent {}

@Component({ selector: 'app-admin-user-search', template: '' })
class AdminUserSearchStubComponent {}

@Component({ selector: 'app-admin-app-template-search', template: '' })
class AdminAppTemplateSearchStubComponent {}

@Component({ selector: 'app-admin-roles', template: '' })
class AdminRolesStubComponent {}

@Component({ selector: 'app-admin-subscription-search', template: '' })
class AdminSubscriptionSearchStubComponent {}

async function renderAdmin(
  overrides: { permissions?: SystemPermission[]; section?: string | null } = {},
) {
  const { permissions = [], section = null } = overrides;

  const rendered = await renderComponent(AdminAppComponent, {
    declarations: [AdminAppComponent],
    imports: [
      MatListModule,
      MatIconModule,
      MatSidenavModule,
      MatToolbarModule,
      MatButtonModule,
      TopbarStubComponent,
      AdminViewSearchStubComponent,
      AdminUserSearchStubComponent,
      AdminAppTemplateSearchStubComponent,
      AdminRolesStubComponent,
      AdminSubscriptionSearchStubComponent,
    ],
    providers: [
      ...permissionDataProviders({ system: permissions }),
      {
        provide: RouterQuery,
        useValue: {
          selectQueryParams: () => of(section),
          select: () => of(null),
        },
      },
    ],
  });

  // Spy on the real Router provided by renderComponent's provideRouter([])
  // so addParam()/sectionChangedFn() don't actually navigate.
  const router = rendered.fixture.debugElement.injector.get(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  return { ...rendered, navigate };
}

describe('AdminAppComponent', () => {
  /**
   * Verifies: the static "Administration" heading is rendered in the template.
   * Interacts with: rendered DOM via Testing Library screen query.
   * Data: default overrides (no permissions).
   */
  it('should display the Administration header', async () => {
    await renderAdmin();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  const navItems: Array<[string, SystemPermission]> = [
    ['Views', SystemPermission.ViewViews],
    ['Application Templates', SystemPermission.ViewApplications],
    ['Subscriptions', SystemPermission.ViewWebhookSubscriptions],
    ['Users', SystemPermission.ViewUsers],
    ['Roles', SystemPermission.ViewRoles],
  ];

  /**
   * Verifies: a nav item renders when its View permission is the only one granted, and no other nav item does.
   * Interacts with: real UserPermissionsService (over stubbed permission endpoints) gating the nav.
   * Data: one row per nav item; permissions = [that item's View permission].
   */
  it.each(navItems)(
    'shows only the %s nav item when %s is granted',
    async (name, permission) => {
      await renderAdmin({ permissions: [permission] });
      expect(screen.getByText(name)).toBeInTheDocument();
      for (const [other] of navItems.filter(([n]) => n !== name)) {
        expect(screen.queryByText(other)).not.toBeInTheDocument();
      }
    },
  );

  /**
   * Verifies: a nav item is hidden when every system permission except its View permission is granted (near miss: the Manage permission on the same resource and every other View permission).
   * Interacts with: real UserPermissionsService (over stubbed permission endpoints) gating the nav.
   * Data: one row per nav item; permissions = every SystemPermission but that item's View permission.
   *   The API also requires the View permission itself (for example Views/Requests/GetAll.cs:50).
   */
  it.each(navItems)(
    'hides the %s nav item when everything but %s is granted',
    async (name, permission) => {
      await renderAdmin({
        permissions: Object.values(SystemPermission).filter(
          (p) => p !== permission,
        ),
      });
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    },
  );

  describe('addParam()', () => {
    /**
     * Verifies: addParam stores the param and calls Router.navigate with
     *   queryParamsHandling: 'merge' so existing params survive.
     * Interacts with: spied Router.navigate (mocked to resolve true).
     * Data: single param { foo: 'bar' }.
     */
    it('merges params and navigates with queryParamsHandling merge', async () => {
      const { fixture, navigate } = await renderAdmin();
      navigate.mockClear();
      fixture.componentInstance.addParam({ foo: 'bar' });
      expect(fixture.componentInstance.queryParams).toEqual({ foo: 'bar' });
      expect(navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { foo: 'bar' },
          queryParamsHandling: 'merge',
        }),
      );
    });

    /**
     * Verifies: successive addParam calls merge into a single queryParams object
     *   rather than replacing it.
     * Interacts with: component.queryParams accumulator (Router.navigate spied).
     * Data: two sequential params { a: '1' } then { b: '2' }.
     */
    it('accumulates params across calls', async () => {
      const { fixture } = await renderAdmin();
      fixture.componentInstance.addParam({ a: '1' });
      fixture.componentInstance.addParam({ b: '2' });
      expect(fixture.componentInstance.queryParams).toEqual({ a: '1', b: '2' });
    });
  });

  describe('sectionChangedFn()', () => {
    const cases: Array<[Section, string]> = [
      [Section.ADMIN_VIEWS, 'Views'],
      [Section.ADMIN_USERS, 'Users'],
      [Section.ADMIN_APP_TEMP, 'Application Templates'],
      [Section.ADMIN_ROLE_PERM, 'Roles / Permissions'],
      [Section.ADMIN_SUBS, 'Subscriptions'],
    ];

    /**
     * Verifies: for each Section, sectionChangedFn sets the matching human title
     *   and navigates adding the section query param.
     * Interacts with: spied Router.navigate (mocked to resolve true).
     * Data: cases table mapping each Section enum to its display title.
     */
    it.each(cases)(
      'sets the title for section %s to "%s" and adds the section param',
      async (section, title) => {
        const { fixture, navigate } = await renderAdmin();
        navigate.mockClear();
        fixture.componentInstance.sectionChangedFn(section);
        expect(fixture.componentInstance.title).toBe(title);
        expect(navigate).toHaveBeenCalledWith(
          [],
          expect.objectContaining({ queryParams: { section } }),
        );
      },
    );
  });

  /**
   * Verifies: ngOnInit reads the 'section' query param and runs it through
   *   sectionChangedFn so the title reflects the param.
   * Interacts with: RouterQuery.selectQueryParams stub feeding ngOnInit.
   * Data: section override = ADMIN_USERS.
   */
  it('ngOnInit applies the section from the query param', async () => {
    const { fixture } = await renderAdmin({ section: Section.ADMIN_USERS });
    // ngOnInit subscribes to selectQueryParams('section') and routes it
    // through sectionChangedFn, which sets the title.
    expect(fixture.componentInstance.title).toBe('Users');
  });

  /**
   * Verifies: a valid section query param renders that section even when the user lacks its View permission (current behavior).
   * Interacts with: RouterQuery.selectQueryParams stub; real UserPermissionsService over stubbed permission endpoints; the section child stubs.
   * Data: section = ADMIN_ROLE_PERM with ViewViews granted and ViewRoles not.
   */
  it('renders a section from the query param without checking its permission', async () => {
    const { fixture } = await renderAdmin({
      section: Section.ADMIN_ROLE_PERM,
      permissions: [SystemPermission.ViewViews],
    });
    expect(
      fixture.debugElement.query(By.directive(AdminRolesStubComponent)),
    ).not.toBeNull();
    expect(
      fixture.debugElement.query(By.directive(AdminViewSearchStubComponent)),
    ).toBeNull();
  });

  /**
   * Verifies: with no section query param, section$ falls back to the first
   *   section the user's permissions allow.
   * Interacts with: RouterQuery.selectQueryParams stub; real UserPermissionsService over stubbed permission endpoints.
   * Data: section = null with only ViewUsers permission granted.
   * Why: subscribes via a Promise to capture the single emitted value.
   */
  it('section$ falls back to the first permitted section when no query param', async () => {
    const { fixture } = await renderAdmin({
      section: null,
      permissions: [SystemPermission.ViewUsers],
    });
    const emitted = await new Promise<Section | undefined>((resolve) =>
      fixture.componentInstance.section$.subscribe(resolve),
    );
    expect(emitted).toBe(Section.ADMIN_USERS);
  });

  /**
   * Verifies: ngOnDestroy completes the unsubscribe$ subject to tear down
   *   subscriptions.
   * Interacts with: spy on component.unsubscribe$.complete.
   * Data: default render.
   */
  it('ngOnDestroy completes the unsubscribe subject', async () => {
    const { fixture } = await renderAdmin();
    const complete = vi.spyOn(
      fixture.componentInstance.unsubscribe$,
      'complete',
    );
    fixture.componentInstance.ngOnDestroy();
    expect(complete).toHaveBeenCalled();
  });
});
