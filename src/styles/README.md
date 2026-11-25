# Player styles

Player's look is an Angular Material 3 theme. Components are standard Material components, styled through
Material's system variables (`--mat-sys-*`) and component tokens (`mat.*-overrides`). Very little CSS reaches
into a Material component.

## Where things live

| File                  | What goes there                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_player-theme.scss`  | `mat.theme` and its system-variable overrides (palette, type sizes, corners), the Player colours Material has no role for (`--player-*`), the app-wide component overrides, the variant classes, and the Exceptions.           |
| `_layout.scss`        | The base (body, headings, links, focus ring, reduced motion) and the page layout classes (`player-page`, `player-sheet`, `player-head`, `player-tools`, `player-grid`, `player-list`, `player-empty`). No Material components. |
| `styles.scss`         | Imports, and a few global utilities that templates still use.                                                                                                                                                                  |
| A component's `.scss` | Layout of that component's own markup, and token overrides scoped to it, e.g. `@include mat.list-overrides(...)` on a class in its template.                                                                                   |

Colours, sizes and corners come from the theme. In a component, use `var(--mat-sys-*)` or `var(--player-*)`
rather than a literal colour.

## Variant classes

A variant is a class a template puts on a container or a component's host. It sets component tokens for
everything inside it.

| Class                                             | Put it on                                                  | Gives                                                                |
| ------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `player-dense-buttons`                            | a row of buttons (a list's tools, a form's single action)  | 28px buttons, 12px text, 16px icons; outlined buttons on the surface |
| `player-dense-field`                              | a `mat-form-field` in a dense row                          | a 33px field on the surface                                          |
| `player-toolbar`                                  | the app bar's `mat-toolbar`                                | a 48px surface bar with 13px text and 28px tools                     |
| `player-toolbar-tool`                             | a button in the app bar                                    | muted, and the accent on its soft fill while its menu is open        |
| `player-flat-panels`                              | a `mat-expansion-panel` or the `mat-accordion` around them | panels with no corners or shadow                                     |
| `player-status-chip`, `player-status-chip-online` | a `mat-chip`                                               | a small offline or online status chip                                |
| `player-template-badge`                           | a `span` beside a view's name                              | the TEMPLATE badge                                                   |

Before adding a component rule, check whether a variant already covers it.

## Rules

- **Tokens first.** Look for a token in the component's `_m3-*.scss` (under `@angular/material/<component>/`).
  The `mat.*-overrides` mixins fail the build on an unknown key, so a typo can't slip through.
- **Exceptions only where Material has no token.** Style the host element Player declares in its template
  (`mat-icon`, `mat-row`, `button[mat-menu-item]`, a class you put on the host). Never style Material's
  internal elements (`.mdc-*`, `.mat-mdc-*-content` and the like). With emulated encapsulation those rules
  don't match anyway, and when they do they break on upgrades.
- **Tag each exception** `// FRAGILE: no Material token (...)`, with the angular/components issue where there
  is one. Re-check every FRAGILE rule on each Material major upgrade.
- **Use Material's options before CSS.** Use DI defaults (`MAT_FORM_FIELD_DEFAULT_OPTIONS`,
  `MAT_DIALOG_DEFAULT_OPTIONS`, `MAT_CARD_CONFIG` in `app.config.ts`), component inputs
  (`sticky: true` on a header row, `matButton="outlined"`) and the theme's density.
- **No `!important`** against Material. If a rule needs it, there is usually a token.

## Gotchas

- `mat.theme`'s overrides (and `mat.theme-overrides`) silently ignore a key they don't know. Check a new key
  against `@angular/material/core/tokens/_system.scss`.
- A per-component density mixin with a bare number (`mat.form-field-density(-4)`) uses the M2 scale, not the
  theme's M3 density. Set the token you want (`container-height`) instead.
- The theme's density (-2) already sets 32px buttons, 32px checkbox and radio targets, 40px tabs and 40px
  collapsed expansion headers. Don't repeat them as overrides.
- A toolbar draws its buttons in its own text colour. To colour a button in a toolbar, set
  `mat.toolbar-overrides((container-text-color: ...))` on the button.
- `primary` and `on-primary` aren't in the theme. `CrucibleThemeService` (@cmusei/crucible-common) writes them
  inline from the app's settings. The accent's soft tints are mixed from them with `color-mix()`.
- Dark mode follows `color-scheme`, which is dark while `body` has the `darkMode` class. Theme colours are
  `light-dark(light, dark)` pairs.
