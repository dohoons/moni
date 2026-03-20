const SkeletonItem = () => (
  <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
    <div className="flex-1">
      <div className="mb-1 h-5 w-32 animate-pulse rounded bg-gray-200" />
      <div className="flex gap-2">
        <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
        <div className="h-5 w-12 animate-pulse rounded-full bg-gray-200" />
      </div>
    </div>
    <div className="ml-4 h-5 w-20 animate-pulse rounded bg-gray-200" />
  </div>
);

export default SkeletonItem;
