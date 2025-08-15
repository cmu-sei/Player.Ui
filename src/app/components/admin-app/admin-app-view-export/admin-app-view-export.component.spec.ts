import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAppViewExportComponent } from './admin-app-view-export.component';

describe('AdminAppViewExportComponent', () => {
  let component: AdminAppViewExportComponent;
  let fixture: ComponentFixture<AdminAppViewExportComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AdminAppViewExportComponent]
    });
    fixture = TestBed.createComponent(AdminAppViewExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
