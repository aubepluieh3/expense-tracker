export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      {description && <p className="mt-2 text-sm text-neutral-600">{description}</p>}
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
    </main>
  )
}

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
      {children}
    </p>
  )
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="status" className="rounded-lg bg-neutral-100 px-3 py-2.5 text-sm text-neutral-700">
      {children}
    </p>
  )
}
