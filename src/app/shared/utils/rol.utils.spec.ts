import { Rol } from '../models/user.model';
import {
  esAdminOSuperior,
  esSuperadmin,
  etiquetaRol,
  etiquetaRolCorta,
} from './rol.utils';

describe('rol.utils', () => {
  describe('esAdminOSuperior', () => {
    it('true para ADMIN y SUPERADMIN', () => {
      expect(esAdminOSuperior(Rol.ADMIN)).toBe(true);
      expect(esAdminOSuperior(Rol.SUPERADMIN)).toBe(true);
    });

    it('false para ALUMNO y valores vacíos', () => {
      expect(esAdminOSuperior(Rol.ALUMNO)).toBe(false);
      expect(esAdminOSuperior(undefined)).toBe(false);
      expect(esAdminOSuperior(null)).toBe(false);
      expect(esAdminOSuperior('SIN_APROBACION')).toBe(false);
    });

    it('acepta el string crudo del JWT', () => {
      expect(esAdminOSuperior('SUPERADMIN')).toBe(true);
      expect(esAdminOSuperior('ALUMNO')).toBe(false);
    });
  });

  describe('esSuperadmin', () => {
    it('true solo para SUPERADMIN', () => {
      expect(esSuperadmin(Rol.SUPERADMIN)).toBe(true);
      expect(esSuperadmin(Rol.ADMIN)).toBe(false);
      expect(esSuperadmin(Rol.ALUMNO)).toBe(false);
      expect(esSuperadmin(undefined)).toBe(false);
    });
  });

  describe('etiquetaRol', () => {
    it('mapea cada rol a su etiqueta completa', () => {
      expect(etiquetaRol(Rol.SUPERADMIN)).toBe('Superadministrador');
      expect(etiquetaRol(Rol.ADMIN)).toBe('Administrador');
      expect(etiquetaRol(Rol.ALUMNO)).toBe('Alumno');
    });

    it('cae a "Alumno" para valores desconocidos', () => {
      expect(etiquetaRol(undefined)).toBe('Alumno');
      expect(etiquetaRol(null)).toBe('Alumno');
    });
  });

  describe('etiquetaRolCorta', () => {
    it('mapea cada rol a su etiqueta corta', () => {
      expect(etiquetaRolCorta(Rol.SUPERADMIN)).toBe('Super');
      expect(etiquetaRolCorta(Rol.ADMIN)).toBe('Admin');
      expect(etiquetaRolCorta(Rol.ALUMNO)).toBe('Alumno');
      expect(etiquetaRolCorta(undefined)).toBe('Alumno');
    });
  });
});
