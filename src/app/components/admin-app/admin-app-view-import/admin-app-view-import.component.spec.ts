import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAppViewImportComponent } from './admin-app-view-import.component';

describe('AdminAppViewImportComponent', () => {
  let component: AdminAppViewImportComponent;
  let fixture: ComponentFixture<AdminAppViewImportComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AdminAppViewImportComponent]
    });
    fixture = TestBed.createComponent(AdminAppViewImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
