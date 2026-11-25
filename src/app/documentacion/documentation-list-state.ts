import { ParamMap, Params } from '@angular/router';
import { PaginationFilter } from '../shared/models/pagination.model';

const LISTA_QUERY_KEYS = [
  'searchTerm',
  'skip',
  'take',
  'createdAt',
  'temaId',
  'isLocked',
  'requireWatermark',
];

export function parametrosListaDocumentacion(params: ParamMap): Params {
  const lista: Params = {};
  for (const key of LISTA_QUERY_KEYS) {
    const value = params.get(key);
    if (value !== null) lista[key] = value;
  }
  return lista;
}

function fecha(valor: string | undefined) {
  if (!valor?.trim()) return null;
  const date = new Date(Number(valor));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function paginacionDocumentacion(params: ParamMap): PaginationFilter {
  const skip = Number(params.get('skip'));
  const take = Number(params.get('take'));
  const [desde, hasta] = (params.get('createdAt') ?? '').split(',').map(fecha);
  const temas = (params.get('temaId') ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  const where = {
    ...(desde || hasta ? { createdAt: { gte: desde, lte: hasta } } : {}),
    ...(temas.length ? { temaId: { in: temas } } : {}),
    ...(params.get('isLocked') === 'true' ? { isLocked: true } : {}),
    ...(params.get('requireWatermark') === 'true'
      ? { requireWatermark: true }
      : {}),
  };
  return {
    skip: Number.isSafeInteger(skip) && skip >= 0 ? skip : 0,
    take: Number.isSafeInteger(take) && take > 0 ? take : 10,
    searchTerm: params.get('searchTerm') ?? '',
    where: Object.keys(where).length ? where : undefined,
  };
}

export function filtrosDocumentacion(where: PaginationFilter['where']): Params {
  const { createdAt, temaId, isLocked, requireWatermark } = where ?? {};
  const gte = createdAt?.gte?.getTime();
  const lte = createdAt?.lte?.getTime();
  return {
    createdAt: gte != null || lte != null ? `${gte ?? ''},${lte ?? ''}` : null,
    temaId: temaId?.in?.length ? temaId.in.join(',') : null,
    isLocked: isLocked === true ? 'true' : null,
    requireWatermark: requireWatermark === true ? 'true' : null,
  };
}
