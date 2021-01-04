// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminUserSearchComponent } from './admin-user-search.component';

describe('AdminUserSearchComponent', () => {
  let component: AdminUserSearchComponent;
  let fixture: ComponentFixture<AdminUserSearchComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [AdminUserSearchComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminUserSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
