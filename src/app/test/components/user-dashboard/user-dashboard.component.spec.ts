import { of } from 'rxjs';
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
    component.auth = {
      impersonateUser$: jest.fn(() => of({})),
    };
    component.toast = { error: jest.fn(), success: jest.fn() };
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

  it('ofrece las acciones de fila navegando a la ficha con ?action=', () => {
    const component = build();
    const items = component.getActionItems({ id: 7 } as any);
    const labels = items.map((i: any) => i.label);
    expect(labels).toEqual([
      'Ver ficha',
      'Acceder como usuario',
      'Editar',
      'Suscripción',
      'Gestionar etiquetas',
      'Eliminar',
    ]);
    items[2].command();
    expect(component.router.navigate).toHaveBeenCalledWith(
      ['/app/test/user', 7],
      {
        queryParams: expect.objectContaining({ action: 'editar' }),
      },
    );
  });

  it('impersonar desde el menú de fila usa el AuthService y navega al perfil', () => {
    const component = build();
    component.getActionItems({ id: 7 } as any)[1].command();
    expect(component.auth.impersonateUser$).toHaveBeenCalledWith(7);
    expect(component.router.navigate).toHaveBeenCalledWith(['/app/profile']);
  });

  it('las acciones de "Ver ficha" y "Eliminar" navegan a la ficha con su acción', () => {
    const component = build();
    const items = component.getActionItems({ id: 7 } as any);
    items[0].command();
    expect(component.router.navigate).toHaveBeenCalledWith(
      ['/app/test/user', 7],
      {
        queryParams: expect.not.objectContaining({ action: expect.anything() }),
      },
    );
    items[5].command();
    expect(component.router.navigate).toHaveBeenCalledWith(
      ['/app/test/user', 7],
      {
        queryParams: expect.objectContaining({ action: 'eliminar' }),
      },
    );
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
