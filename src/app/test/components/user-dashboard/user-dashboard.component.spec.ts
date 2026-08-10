import { UserDashboardComponent } from './user-dashboard.component';

describe('UserDashboardComponent', () => {
  const build = (mode: 'overview' | 'selection' = 'overview') => {
    const component = Object.create(
      UserDashboardComponent.prototype,
    ) as UserDashboardComponent & any;
    component.mode = mode;
    component.route = {
      snapshot: {
        queryParams: {
          skip: '20',
          take: '10',
          searchTerm: 'Ana',
          variasPlanificaciones: 'varias',
          validated: 'true',
        },
      },
    };
    component.router = { navigate: jest.fn() };
    component.selectionChange = { emit: jest.fn() };
    component.initialQueryFilterMatched = false;
    component.initialFilterHydrationOpen = true;
    return component;
  };

  it('keeps GenericList serialized filters when opening the detail', () => {
    const component = build();
    component.onItemClick({ id: 7 } as any);
    expect(component.router.navigate).toHaveBeenCalledWith(
      ['/app/test/user', 7],
      {
        queryParams: {
          skip: '20',
          take: '10',
          searchTerm: 'Ana',
          variasPlanificaciones: 'varias',
          validated: 'true',
        },
      },
    );
  });

  it('never navigates in selection mode and still emits the selected ids', () => {
    const component = build('selection');
    component.onItemClick({ id: 7 } as any);
    component.onSelectionChange([7, 9]);
    expect(component.router.navigate).not.toHaveBeenCalled();
    expect(component.selectionChange.emit).toHaveBeenCalledWith([7, 9]);
  });

  it('provides an accessible activity label for the status indicator', () => {
    const component = build();

    expect(component.activityAriaLabel('active')).toBe(
      'Estado de actividad: Activo',
    );
    expect(component.activityAriaLabel('partial')).toBe(
      'Estado de actividad: Parcial',
    );
  });

  it('preserves pagination for the first filter hydration from query params', () => {
    const component = build();
    component.filters = () => [
      {
        key: 'variasPlanificaciones',
        type: 'dropdown',
        filterInterpolation: (value: string) =>
          value === 'varias' ? { variasPlanificaciones: true } : {},
      },
    ];
    component.pagination = () => ({ skip: 0, take: 10, searchTerm: '' });
    component.updatePaginationSafe = jest.fn();

    component.onFiltersChanged({ variasPlanificaciones: true });

    expect(component.updatePaginationSafe).toHaveBeenCalledWith({
      where: { variasPlanificaciones: true },
      skip: 20,
      take: 10,
    });
  });

  it('keeps pagination across repeated hydration emissions and resets it on a new filter', () => {
    const component = build();
    component.filters = () => [
      {
        key: 'variasPlanificaciones',
        type: 'dropdown',
        filterInterpolation: (value: string) =>
          value === 'varias' ? { variasPlanificaciones: true } : {},
      },
    ];
    component.pagination = () => ({ skip: 0, take: 10, searchTerm: '' });
    component.updatePaginationSafe = jest.fn();

    component.onFiltersChanged(undefined);
    component.onFiltersChanged({ variasPlanificaciones: true });
    component.onFiltersChanged({ variasPlanificaciones: true });
    component.onFiltersChanged({ validated: true });
    component.onFiltersChanged({ variasPlanificaciones: true });

    expect(component.updatePaginationSafe).toHaveBeenNthCalledWith(3, {
      where: { variasPlanificaciones: true },
      skip: 20,
      take: 10,
    });
    expect(component.updatePaginationSafe).toHaveBeenNthCalledWith(4, {
      where: { validated: true },
      skip: 0,
    });
    expect(component.updatePaginationSafe).toHaveBeenLastCalledWith({
      where: { variasPlanificaciones: true },
      skip: 0,
    });
  });
});
