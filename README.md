# Player.Ui Readme

Player UI is the front-end to the Player application implementing NPM and Angular version 21.

## Docker

The following table defines Docker environment variables that can be set at deployment to configure running services.

| Variable     | Required | Description                                                                                                    |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| APP_BASEHREF | No       | Base path the app is served under (e.g. `/player`). Rewrites `<base href>` in `index.html` at container start. |

API and authentication endpoints are not Docker environment variables; they are configured in `assets/config/settings.env.json` (see [Settings](#settings)).

## Development

### Required Software

- `Node.js` SDK which includes NPM. Angular 21 requires Node `^20.19.0`, `^22.12.0`, or `>=24.0.0`.
- VS Code
- Recommended to update NPM (`npm update -g npm`)
- Optionally install the Angular CLI globally (`npm install -g @angular/cli`); otherwise use `npm start`, which runs the project's local copy
- Clone the repo: `git clone https://github.com/cmu-sei/Player.Ui.git`
- Move to the repo directory, `cd Player.Ui`
- Install the NPM dependencies: `npm install`
- Run the server: `npm start` (or `ng serve`)

### Settings

All configurable values (URLs, etc.) should be made to use the settings service (`ComnSettingsService` from `@cmusei/crucible-common`). It loads its values from configuration files located in `/assets/config/`. The following files are used:

- **settings.json:** This file is committed to source control, and holds default values for all settings. Changes should only be made to this file to add new settings, or change the default value of a setting that will affect everyone who pulls down the project.
- **settings.shared.json:** This file is _not_ committed to source control. It holds settings shared across Crucible apps and overrides `settings.json`.
- **settings.env.json:** This file is _not_ committed to source control, and will differ for each environment. Settings can be placed into this file and they will override settings found in `settings.json`. Any settings not found in this file will default to the values in `settings.json`.

In a production environment, `settings.env.json` should contain only the settings that need to be changed for that environment; `settings.json` serves as a reference for the default values as well as any unchanged settings. `settings.json` should not be altered in a production environment for any reason.

## Running unit tests

Player UI runs its unit tests with Angular's `@angular/build:unit-test` builder, **Vitest** in jsdom and
`@testing-library/angular`, with zone change detection as the app uses. The setup follows the shared
Crucible UI test standard (`agent-docs/ui-testing/` in the Crucible workspace).

```bash
npm test               # run every spec once (ng test --watch=false)
npm run test:watch     # re-run specs on change (ng test)
npm run test:coverage  # run once with v8 coverage and enforce the thresholds in angular.json (what CI runs)
```

Test helpers live in `src/app/test-utils/`: `renderComponent` with the app's default providers
(`default-test-providers.ts`), typed API stubs (`api-stub.ts`), a SignalR hub fake
(`fake-hub-connection.ts`), and `permissionDataProviders(grants)` (`mock-permission-data.service.ts`),
which runs the real `UserPermissionsService` over stubbed "my permissions" endpoints.

### Permission Tests

The three-tier permission system (System, Team, View) is tested against the real `UserPermissionsService`:

| File                                                                                 | Coverage                                                                                                                |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `src/app/test-utils/mock-permission-data.service.ts`                                 | `permissionDataProviders({ system, teams })`: the real service over stubbed `getMyPermissions` / `getMyTeamPermissions` |
| `src/app/services/permissions/user-permissions.service.spec.ts`                      | All 12 `SystemPermission` values, `canViewAdminstration()`, `can()` with team/view permission paths                     |
| `src/app/components/shared/top-bar/topbar.component.spec.ts`                         | Administration link, Edit View, Manage Teams, Exit Administration visibility                                            |
| `src/app/components/home-app/view-list/view-list.component.spec.ts`                  | `CreateViews` permission gates the "Add New View" button                                                                |
| `src/app/components/admin-app/admin-app.component.spec.ts`                           | `View*` permissions gate the administration sections                                                                    |
| `src/app/components/admin-app/admin-user-search/admin-user-search.component.spec.ts` | `ManageUsers` gates user deletion and the role selectors                                                                |
| `src/app/components/admin-app/admin-roles/roles/roles.component.spec.ts`             | `ManageRoles` gates adding, renaming and deleting roles                                                                 |
| `src/app/components/admin-app/admin-roles/team-roles/team-roles.component.spec.ts`   | `ManageRoles` gates team role editing                                                                                   |
| `src/app/components/player/manage-teams/manage-teams.component.spec.ts`              | `ManageTeam` claims decide which teams the Manage Teams dialog lists                                                    |

Key patterns tested:

- System permission grants access regardless of team/view permission state
- `TeamPermission` and `ViewPermission` grant access when the matching system perm is absent
- `teamId` scoping: only the specified team's permissions are checked when a `teamId` is provided

## Reporting bugs and requesting features

Think you found a bug? Please report all Crucible bugs - including bugs for the individual Crucible apps - in the [cmu-sei/crucible issue tracker](https://github.com/cmu-sei/crucible/issues).

Include as much detail as possible including steps to reproduce, specific app involved, and any error messages you may have received.

Have a good idea for a new feature? Submit all new feature requests through the [cmu-sei/crucible issue tracker](https://github.com/cmu-sei/crucible/issues).

Include the reasons why you're requesting the new feature and how it might benefit other Crucible users.

## License

Copyright 2021 Carnegie Mellon University. See the [LICENSE.md](./LICENSE.md) files for details.
