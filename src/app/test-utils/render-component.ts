// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CUSTOM_ELEMENTS_SCHEMA, Type } from '@angular/core';
import { render, RenderComponentOptions } from '@testing-library/angular';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { getDefaultProviders } from './vitest-default-providers';

export async function renderComponent<T>(
  component: Type<T>,
  options?: Partial<RenderComponentOptions<T>>
) {
  const providers = getDefaultProviders(options?.providers as any);
  return render(component, {
    ...options,
    imports: [
      NoopAnimationsModule,
      RouterTestingModule,
      FormsModule,
      ReactiveFormsModule,
      MatIconTestingModule,
      MatTooltipModule,
      MatCardModule,
      MatTabsModule,
      MatToolbarModule,
      MatFormFieldModule,
      MatInputModule,
      MatExpansionModule,
      MatSlideToggleModule,
      MatDialogModule,
      MatButtonModule,
      MatSidenavModule,
      MatListModule,
      MatMenuModule,
      MatDividerModule,
      ...(options?.imports ?? []),
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA, ...(options?.schemas ?? [])],
    providers,
  });
}
