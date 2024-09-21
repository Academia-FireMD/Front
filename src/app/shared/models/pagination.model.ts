export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    take: number;
    skip: number;
    searchTerm: string;
    count: number;
  };
}

export interface PaginationFilter {
  take: number;
  skip: number;
  searchTerm: string;
  where?: any;
}
