// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { renderComponent } from '../../../test-utils/render-component';
import { AppSwitcherComponent, SwitcherApp } from './app-switcher.component';

const player: SwitcherApp = {
  id: 'player',
  name: 'Player',
  url: 'http://localhost:4301',
};
const caster: SwitcherApp = {
  id: 'caster',
  name: 'Caster',
  url: 'http://localhost:4310',
};
const unlinked: SwitcherApp = { id: 'alloy', name: 'Alloy' };

async function renderSwitcher(apps: SwitcherApp[]) {
  return renderComponent(AppSwitcherComponent, {
    inputs: { apps, self: 'player', label: 'Apps' },
  });
}

describe('AppSwitcherComponent', () => {
  /**
   * Verifies: the menu lists the other apps that have a URL, each opening in a new window; this app and an app without
   *   a URL are left out.
   * Interacts with: the dots button and the menu's items.
   * Data: Player (self), Caster, Alloy without a URL.
   */
  it('lists the other apps that have a URL', async () => {
    await renderSwitcher([player, caster, unlinked]);
    await userEvent.click(screen.getByRole('button', { name: 'Apps' }));
    const links = await screen.findAllByRole('menuitem');
    expect(links.map((link) => link.textContent?.trim())).toEqual(['CCaster']);
    expect(links[0]).toHaveAttribute('href', 'http://localhost:4310');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noopener');
  });

  /**
   * Verifies: with no other app to open, there is no button at all.
   * Interacts with: the rendered template.
   * Data: Player (self) and an app without a URL; then no apps.
   */
  it('is hidden when no other app has a URL', async () => {
    const { rerender } = await renderSwitcher([player, unlinked]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await rerender({ inputs: { apps: [], self: 'player' } });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /**
   * Verifies: Escape closes the menu and returns focus to the button.
   * Interacts with: the dots button; the Escape key.
   * Data: Player (self), Caster.
   */
  it('closes on Escape and returns focus to the button', async () => {
    await renderSwitcher([player, caster]);
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Apps' });
    await user.click(button);
    const menu = await screen.findByRole('menu');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(menu, { key: 'Escape', keyCode: 27 });
    await waitFor(() =>
      expect(button).toHaveAttribute('aria-expanded', 'false'),
    );
    expect(button).toHaveFocus();
  });
});
