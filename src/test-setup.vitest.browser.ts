if (!(globalThis as any)['__vitest_zone_patch__']) {
  await import('@analogjs/vitest-angular/setup-zone');
}

import '@angular/material/prebuilt-themes/azure-blue.css';

import '@mdi/font/css/materialdesignicons.css';
import 'font-awesome/css/font-awesome.css';

import 'bootstrap/scss/bootstrap-utilities.scss';

import './styles/styles.scss';

import '@testing-library/jest-dom/vitest';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

if (!(globalThis as any)['__vitest_angular_testbed_init__']) {
  (globalThis as any)['__vitest_angular_testbed_init__'] = true;
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
    {
      teardown: { destroyAfterEach: false, rethrowErrors: false },
    }
  );
}

beforeEach(() => {
  try {
    getTestBed().resetTestingModule();
  } catch (e) {}

  document
    .querySelectorAll('.cdk-overlay-container')
    .forEach((el) => el.remove());

  document.body.classList.add('mat-typography', 'mat-app-background');
});
