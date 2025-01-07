import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentationOverviewComponent } from './documentation-overview.component';

describe('DocumentationOverviewComponent', () => {
  let component: DocumentationOverviewComponent;
  let fixture: ComponentFixture<DocumentationOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocumentationOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentationOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
