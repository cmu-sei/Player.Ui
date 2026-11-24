// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { renderComponent } from '../../../test-utils/render-component';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  /**
   * Verifies: the footer names the product from the settings and links to the Crucible repository in a new window.
   * Interacts with: the rendered template; ComnSettingsService (default test settings).
   * Data: AppTopBarText 'Player'.
   */
  it('names the product and links to the repository', async () => {
    await renderComponent(FooterComponent);
    expect(screen.getByText('Player.')).toBeInTheDocument();
    expect(
      screen.getByText(/Part of the Crucible Framework\./),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Crucible on GitHub' });
    expect(link).toHaveAttribute('href', 'https://github.com/cmu-sei/crucible');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });
});
