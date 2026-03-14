import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { DocumentationOverviewComponent } from './documentation-overview.component';

describe('DocumentationOverviewComponent', () => {
  let component: DocumentationOverviewComponent;
  let fixture: ComponentFixture<DocumentationOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocumentationOverviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentationOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
