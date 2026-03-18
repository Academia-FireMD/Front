import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TemplateRef } from '@angular/core';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { GenericListComponent } from './generic-list.component';

describe('GenericListComponent', () => {
  let component: GenericListComponent<{ id: number }>;
  let fixture: ComponentFixture<GenericListComponent<{ id: number }>>;
  let emittedSelections: (string | number)[][];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenericListComponent],
      providers: [...COMMON_TEST_PROVIDERS],
    })
      .overrideComponent(GenericListComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(GenericListComponent<{ id: number }>);
    component = fixture.componentInstance;
    component.itemTemplate = {} as TemplateRef<unknown>;
    component.fetchItems$ = signal(
      of({
        data: [{ id: 1 }, { id: 2 }, { id: 3 }],
        pagination: { skip: 0, take: 10, searchTerm: '', count: 3 },
      })
    );
    component.mode = 'selection';
    component.getItemId = (item) => item.id;
    component.lastLoadedPagination = {
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      pagination: { skip: 0, take: 10, searchTerm: '', count: 3 },
    } as any;
    emittedSelections = [];
    component.selectionChange.subscribe((ids) => emittedSelections.push(ids));
  });

  it('toggleItemSelection con singleSelection=false acumula selección', () => {
    component.singleSelection = false;
    component.selectedItemIds = [];

    component.toggleItemSelection({ id: 1 });
    expect(emittedSelections).toContainEqual([1]);

    component.selectedItemIds = [1];
    component.toggleItemSelection({ id: 2 });
    expect(emittedSelections).toContainEqual([1, 2]);

    component.selectedItemIds = [1, 2];
    component.toggleItemSelection({ id: 1 });
    expect(emittedSelections).toContainEqual([2]);
  });

  it('toggleItemSelection con singleSelection=true reemplaza selección', () => {
    component.singleSelection = true;
    component.selectedItemIds = [];

    component.toggleItemSelection({ id: 1 });
    expect(emittedSelections).toContainEqual([1]);

    component.selectedItemIds = [1];
    component.toggleItemSelection({ id: 2 });
    expect(emittedSelections).toContainEqual([2]);

    component.selectedItemIds = [2];
    component.toggleItemSelection({ id: 2 });
    expect(emittedSelections).toContainEqual([]);
  });
});
