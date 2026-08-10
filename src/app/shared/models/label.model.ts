export interface Label {
  id: string;
  key: string;
  value?: string | null;
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

/** Canonical display name for a label wherever key/value disambiguation matters. */
export function labelDisplay(label: Pick<Label, 'key' | 'value'>): string {
  return label.value ? `${label.key}: ${label.value}` : label.key;
}
