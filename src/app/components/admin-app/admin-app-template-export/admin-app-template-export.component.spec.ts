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
