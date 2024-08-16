import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const toast = inject(ToastrService);
  const token = sessionStorage.getItem('authToken');

  if (!token) {
    router.navigate(['/auth']);
    toast.warning('No se ha loggeado, redirigiendo al login...');
    return false;
  }

  const payload = JSON.parse(atob(token.split('.')[1]));

  const userRole = payload.rol;

  const expectedRole = route.data['expectedRole'];

  if (userRole === expectedRole || userRole == 'ADMIN') {
    return true;
  } else {
    router.navigate(['/auth']);
    toast.error('No tiene permiso para acceder a esta ruta');
    return false;
  }
};
