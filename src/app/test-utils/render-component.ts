// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EnvironmentProviders, Provider, Type } from '@angular/core';
import { render, RenderComponentOptions } from '@testing-library/angular';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { getDefaultProviders } from './default-test-providers';

export async function renderComponent<T>(
  component: Type<T>,
  options?: Partial<RenderComponentOptions<T>>,
) {
  const providers: (Provider | EnvironmentProviders)[] = [
    provideRouter([]),
    ...getDefaultProviders(options?.providers),
  ];
  return render(component, {
    ...options,
    imports: [
      NoopAnimationsModule,
      RouterModule,
      FormsModule,
      ReactiveFormsModule,
      MatIconTestingModule,
      ...(options?.imports ?? []),
    ],
    providers,
  });
}
