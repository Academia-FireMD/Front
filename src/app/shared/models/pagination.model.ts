export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    take: number;
    skip: number;
    searchTerm: string;
    count: number;
    where?: PaginationFilter['where'];
  };
}

export interface PaginationFilter {
  take: number;
  skip: number;
  searchTerm: string;
  where?: any;
}
