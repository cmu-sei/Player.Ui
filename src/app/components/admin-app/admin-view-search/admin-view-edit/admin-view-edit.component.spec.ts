// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminViewEditComponent } from './admin-view-edit.component';

describe('AdminViewEditComponent', () => {
  let component: AdminViewEditComponent;
  let fixture: ComponentFixture<AdminViewEditComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [AdminViewEditComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminViewEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
