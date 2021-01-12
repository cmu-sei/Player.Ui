// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminRolePermissionSearchComponent } from './admin-role-permission-search.component';

describe('AdminAppRolePermissionSearchComponent', () => {
  let component: AdminRolePermissionSearchComponent;
  let fixture: ComponentFixture<AdminRolePermissionSearchComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [AdminRolePermissionSearchComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminRolePermissionSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
