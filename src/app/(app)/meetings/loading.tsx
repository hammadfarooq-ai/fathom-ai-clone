import { Card, Skeleton } from "@/components/ui/primitives";

export default function LoadingMeetings() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading meetings">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <Skeleton className="h-9 w-80 max-w-full" />
      <Card className="space-y-1 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-2">
            <Skeleton className="h-12 w-[76px] rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="hidden h-6 w-20 sm:block" />
          </div>
        ))}
      </Card>
    </div>
  );
}
