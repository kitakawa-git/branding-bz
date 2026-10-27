import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // data-skeleton: 読み込み中の目印。FadeInMain（components/ui/fade-in-main.tsx）がこれの消えた後の内容をふわっと出す
      data-skeleton=""
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
