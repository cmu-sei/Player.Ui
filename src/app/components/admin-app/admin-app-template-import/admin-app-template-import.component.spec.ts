/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAppTemplateImportComponent } from './admin-app-template-import.component';

describe('AdminAppTemplateImportComponent', () => {
  let component: AdminAppTemplateImportComponent;
  let fixture: ComponentFixture<AdminAppTemplateImportComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AdminAppTemplateImportComponent]
    });
    fixture = TestBed.createComponent(AdminAppTemplateImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
