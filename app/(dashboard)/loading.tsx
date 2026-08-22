/** Skeleton mientras cargan los datos de la sección. Da feedback inmediato al
 *  navegar (la barra de nav persiste; solo el contenido muestra el esqueleto). */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-8 w-40 rounded-lg bg-muted" />
      <div className="h-36 rounded-2xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 rounded-xl bg-muted" />
        <div className="h-28 rounded-xl bg-muted" />
      </div>
      <div className="h-48 rounded-xl bg-muted" />
    </div>
  );
}
