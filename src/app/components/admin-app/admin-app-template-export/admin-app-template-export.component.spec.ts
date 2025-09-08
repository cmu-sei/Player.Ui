/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAppTemplateExportComponent } from './admin-app-template-export.component';

describe('AdminAppTemplateExportComponent', () => {
  let component: AdminAppTemplateExportComponent;
  let fixture: ComponentFixture<AdminAppTemplateExportComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AdminAppTemplateExportComponent]
    });
    fixture = TestBed.createComponent(AdminAppTemplateExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
