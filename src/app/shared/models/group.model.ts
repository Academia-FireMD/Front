export interface Group {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  miembros?: UsuarioGroup[];
}

export interface UsuarioGroup {
  userId: number;
  groupId: string;
  usuario?: {
    id: number;
    nombre: string;
    apellidos: string;
    email: string;
  };
  group?: Group;
}

export interface CreateGroupDto {
  name: string;
}

