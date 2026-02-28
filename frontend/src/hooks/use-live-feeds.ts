import { useQuery } from "@tanstack/react-query"
import { fetchDataSources, type LiveFeedsResponse } from "@/lib/api"

export function useLiveFeeds() {
  return useQuery({
    queryKey: ["liveFeeds"],
    queryFn: async (): Promise<LiveFeedsResponse> => {
      const data = await fetchDataSources()
      return data.liveFeeds
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    retry: 1,
  })
}
