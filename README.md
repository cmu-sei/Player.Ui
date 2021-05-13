# Player.Ui Readme

Player UI is the front-end to the Player application implementing NPM and Angular version 4.0.

## Docker

The following table defines Docker environment variables that can be set at deployment to configure running services.

| Variable    | Required | Description                                 |
| ----------- | -------- | ------------------------------------------- |
| SERVER_NAME | Yes      | Fully-qualified domain name for the server. |
| API_URL     | Yes      | URL for the Scenario Player API.            |

### Required Software

- `Node.js` SDK which includes NPM
- VS Code
- Recommended to update NPM (`npm update -g npm`)
- Install latest Angular-CLI
- Clone the repo: `git clone https://github.com/cmu-sei/Player.Ui.git`
- Move to player.ui directory, `cd player.ui`
- Install the NPM dependencies: `npm install`
- Run the server: `ng serve`

### Settings

All configurable values (URLs, etc.) should be made to use the **SettingsService**. The **SettingsService** loads its values from configuration files located in `/assets/config/`. There are two files used for this. They are as follows:

- **settings.json:** This file is committed to source control, and holds default values for all settings. Changes should only be made to this file to add new settings, or change the default value of a setting that will affect everyone who pulls down the project.
- **settings.env.json:** This file is _not_ committed to source control, and will differ for each environment. Settings can be placed into this file and they will override settings found in `settings.json`. Any settings not found in this file will default to the values in `settings.json`.

In a production environment, `settings.env.json` should contain only the settings that need to be changed for that environment; `settings.json` serves as a reference for the default values as well as any unchanged settings. `settings.json` should not be altered in a production environment for any reason.

## Reporting bugs and requesting features

Think you found a bug? Please report all Crucible bugs - including bugs for the individual Crucible apps - in the [cmu-sei/crucible issue tracker](https://github.com/cmu-sei/crucible/issues).

Include as much detail as possible including steps to reproduce, specific app involved, and any error messages you may have received.

Have a good idea for a new feature? Submit all new feature requests through the [cmu-sei/crucible issue tracker](https://github.com/cmu-sei/crucible/issues).

Include the reasons why you're requesting the new feature and how it might benefit other Crucible users.

## License

Copyright 2021 Carnegie Mellon University. See the [LICENSE.md](./LICENSE.md) files for details.
