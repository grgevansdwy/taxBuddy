// Shared frame for the auth screens: a left-aligned heading + subtext with the
// form sitting directly on the page background (no card), matching the split-
// screen reference. Each auth page supplies its own title/description/footer.
export function AuthPanel({
  icon,
  title,
  description,
  children,
  footer,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2">
        {icon && (
          <div className="flex size-12 items-center justify-center rounded-full bg-accent text-2xl">{icon}</div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
