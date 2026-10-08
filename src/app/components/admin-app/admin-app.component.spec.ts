// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import { BehaviorSubject, of } from 'rxjs';
import userEvent from '@testing-library/user-event';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AdminAppComponent, Section } from './admin-app.component';
import { TopbarView } from '../shared/top-bar/topbar.models';
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
  const section$ = new BehaviorSubject<string | null>(section);

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
          selectQueryParams: () => section$,
          select: () => of(null),
        },
      },
    ],
  });

  // Spy on the real Router (routerLink needs it) so section clicks don't
  // navigate.
  const router = rendered.fixture.debugElement.injector.get(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  return { ...rendered, navigate, section$ };
}

function topbar(fixture: ComponentFixture<AdminAppComponent>) {
  return fixture.debugElement.query(By.directive(TopbarStubComponent))
    .componentInstance as TopbarStubComponent;
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

  const titles: Array<[string, Section, string]> = [
    ['Views', Section.ADMIN_VIEWS, 'Views'],
    ['Users', Section.ADMIN_USERS, 'Users'],
    ['Application Templates', Section.ADMIN_APP_TEMP, 'Application Templates'],
    ['Roles', Section.ADMIN_ROLE_PERM, 'Roles / Permissions'],
    ['Subscriptions', Section.ADMIN_SUBS, 'Subscriptions'],
  ];

  /**
   * Verifies: clicking a nav item merges its section into the query params and passes the section's title to the topbar.
   * Interacts with: the rendered nav buttons; Router.navigate (spied); the topbar stub's title input.
   * Data: one row per nav item; every View permission granted so every item renders.
   */
  it.each(titles)(
    'clicking %s navigates to section %s and titles the page "%s"',
    async (name, section, title) => {
      const user = userEvent.setup();
      const { fixture, navigate } = await renderAdmin({
        permissions: navItems.map(([, permission]) => permission),
      });
      await user.click(screen.getByText(name));
      expect(navigate).toHaveBeenCalledExactlyOnceWith([], {
        queryParams: { section },
        queryParamsHandling: 'merge',
      });
      expect(topbar(fixture).title()).toBe(title);
    },
  );

  /**
   * Verifies: opening the page with a section query param titles the page for that section.
   * Interacts with: RouterQuery.selectQueryParams stub feeding ngOnInit; the topbar stub's title input.
   * Data: section ADMIN_USERS with ViewUsers granted.
   */
  it('titles the page from the section query param', async () => {
    const { fixture } = await renderAdmin({
      section: Section.ADMIN_USERS,
      permissions: [SystemPermission.ViewUsers],
    });
    expect(topbar(fixture).title()).toBe('Users');
    expect(topbar(fixture).topbarView()).toBe(TopbarView.PLAYER_ADMIN);
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
    // Current behavior; see agent-docs/ui-test-bugs/player.ui.md.
    expect(
      fixture.debugElement.query(By.directive(AdminRolesStubComponent)),
    ).not.toBeNull();
    expect(
      fixture.debugElement.query(By.directive(AdminViewSearchStubComponent)),
    ).toBeNull();
  });

  const sectionStubs: Array<[string, Type<unknown>]> = [
    ['Views', AdminViewSearchStubComponent],
    ['Users', AdminUserSearchStubComponent],
    ['Application Templates', AdminAppTemplateSearchStubComponent],
    ['Roles', AdminRolesStubComponent],
    ['Subscriptions', AdminSubscriptionSearchStubComponent],
  ];

  /** Names of the section children rendered in the main content. */
  function renderedSections(
    fixture: ComponentFixture<AdminAppComponent>,
  ): string[] {
    return sectionStubs
      .filter(([, stub]) => fixture.debugElement.query(By.directive(stub)))
      .map(([name]) => name);
  }

  /**
   * Verifies: with no section query param, the page opens the first section, in nav order, whose View permission the
   *   user holds.
   * Interacts with: RouterQuery.selectQueryParams stub (no section); real UserPermissionsService over stubbed permission
   *   endpoints; the section child stubs.
   * Data: one row per grant list; ViewRoles and ViewUsers together open Users, which comes first in the nav.
   */
  it.each<[string, SystemPermission[], string[]]>([
    ['ViewViews', [SystemPermission.ViewViews], ['Views']],
    ['ViewUsers', [SystemPermission.ViewUsers], ['Users']],
    [
      'ViewRoles and ViewUsers',
      [SystemPermission.ViewRoles, SystemPermission.ViewUsers],
      ['Users'],
    ],
  ])(
    'opens the first permitted section without a query param (%s)',
    async (_grants, permissions, expected) => {
      const { fixture } = await renderAdmin({ section: null, permissions });
      expect(renderedSections(fixture)).toEqual(expected);
    },
  );

  /**
   * Verifies: with no section query param, a user who holds every system permission except the View ones (near miss:
   *   the Manage permissions of every section) gets no section.
   * Interacts with: RouterQuery.selectQueryParams stub (no section); real UserPermissionsService over stubbed permission
   *   endpoints; the section child stubs.
   * Data: every SystemPermission whose name does not start with View.
   */
  it('opens no section without a View permission', async () => {
    const { fixture } = await renderAdmin({
      section: null,
      permissions: Object.values(SystemPermission).filter(
        (p) => !p.startsWith('View'),
      ),
    });
    expect(renderedSections(fixture)).toEqual([]);
  });

  /**
   * Verifies: once the page is destroyed, a later section query param no longer changes the title or navigates.
   * Interacts with: RouterQuery.selectQueryParams (a live subject); fixture.destroy(); Router.navigate (spied).
   * Data: section param changes to ADMIN_SUBS after destroy.
   */
  it('stops following the section query param after destroy', async () => {
    const { fixture, navigate, section$ } = await renderAdmin({
      section: Section.ADMIN_USERS,
      permissions: [SystemPermission.ViewUsers],
    });
    const component = fixture.componentInstance;
    fixture.destroy();
    section$.next(Section.ADMIN_SUBS);
    expect(component.title).toBe('Users');
    expect(navigate).not.toHaveBeenCalled();
  });
});
