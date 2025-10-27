export enum ReleaseItemType {
  TEMA = 'TEMA',
  DOCUMENTO = 'DOCUMENTO'
}

export enum AudienceType {
  ALL = 'ALL',
  SUBSCRIPTION = 'SUBSCRIPTION',
  GROUP = 'GROUP',
  LABEL = 'LABEL',
  INDIVIDUAL = 'INDIVIDUAL'
}

export enum RuleEffect {
  ALLOW = 'ALLOW',
  DENY = 'DENY'
}

export interface Release {
  id: string;
  name: string;
  startAt: Date | string;
  endAt: Date | string;
  items?: ReleaseDocumento[];
  audienceRules?: AudienceRule[];
  createdAt: Date | string;
  updatedAt: Date | string;
  _count?: {
    items?: number;
    audienceRules?: number;
  };
}

export interface ReleaseDocumento {
  id: string;
  releaseId: string;
  itemType: ReleaseItemType;
  temaId?: number;
  documentoId?: number;
  tema?: any;
  documento?: any;
}

export interface AudienceRule {
  id: string;
  releaseId: string;
  type: AudienceType;
  value?: string;
  effect: RuleEffect;
}

export interface CreateReleaseDto {
  name: string;
  startAt: string;
  endAt: string;
}

export interface UpdateReleaseDto {
  name?: string;
  startAt?: string;
  endAt?: string;
}

export interface AddReleaseItemDto {
  itemType: ReleaseItemType;
  temaId?: number;
  documentoId?: number;
}

export interface CreateAudienceRuleDto {
  type: AudienceType;
  value?: string;
  effect?: RuleEffect;
}

