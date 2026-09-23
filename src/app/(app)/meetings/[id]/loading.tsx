import { Card, Skeleton } from "@/components/ui/primitives";

export default function LoadingMeeting() {
  return (
    <div aria-busy="true" aria-label="Loading meeting">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-2 h-4 w-20" />
      <Skeleton className="mb-3 h-7 w-80 max-w-full" />
      <Skeleton className="mb-6 h-4 w-96 max-w-full" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-8 w-48" />
            </div>
          </Card>
          <Card className="space-y-4 p-5">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </Card>
        </div>
        <Card className="hidden space-y-4 p-4 lg:block">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
