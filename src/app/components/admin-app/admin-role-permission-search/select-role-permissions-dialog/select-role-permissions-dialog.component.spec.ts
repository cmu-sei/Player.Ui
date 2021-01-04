// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectRolePermissionsDialogComponent } from './select-role-permissions-dialog.component';

describe('SelectRolePermissionsDialogComponent', () => {
  let component: SelectRolePermissionsDialogComponent;
  let fixture: ComponentFixture<SelectRolePermissionsDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [SelectRolePermissionsDialogComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectRolePermissionsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
