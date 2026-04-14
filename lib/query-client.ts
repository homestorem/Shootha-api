import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Default query function — legacy Express API removed.
 * All queries must provide their own `queryFn` (e.g. API / data layer in screen code).
 */
const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  if (__DEV__) {
    console.warn("[query-client] Query without queryFn:", queryKey);
  }
  return null;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    },
    mutations: {
      retry: false,
    },
  },
});
