import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type QueryFnOptions = {
  on401?: "throw" | "returnNull";
};

/**
 * Default fetch function for use with react-query
 */
export function getQueryFn(options: QueryFnOptions = {}) {
  return async function queryFn<T>({ queryKey }: { queryKey: string[] }): Promise<T> {
    const path = queryKey[0];
    const response = await fetch(path);

    if (!response.ok) {
      if (response.status === 401 && options.on401 === "returnNull") {
        return null as T;
      }
      
      // Try to get error message from response
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const error = await response.json();
        if (error.message || error.error) {
          errorMessage = error.message || error.error;
        }
      } catch (e) {
        // If we can't parse the error, just use the status text
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  };
}

/**
 * Helper function for API requests with proper error handling
 */
export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  url: string,
  data?: any
) {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    let errorMessage = `Error ${response.status}: ${response.statusText}`;
    try {
      const error = await response.json();
      if (error.message || error.error) {
        errorMessage = error.message || error.error;
      }
    } catch (e) {
      // If we can't parse the error, just use the status text
    }
    
    throw new Error(errorMessage);
  }

  return response;
}