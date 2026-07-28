export function FullScreenSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div
        className="size-6 animate-spin rounded-full border-2 border-line-2 border-t-neutral-800"
        role="status"
        aria-label="불러오는 중"
      />
    </div>
  )
}
