export interface Label {
  id: string;
  key: string;
  value?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UsuarioLabel {
  userId: number;
  labelId: string;
  label: Label;
}

export interface CreateLabelDto {
  key: string;
  value?: string;
}

