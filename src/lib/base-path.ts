// Mismo valor que `basePath` en next.config.ts — fuente única. Necesario
// para las navegaciones de página completa (`window.location.href`) que
// no pasan por el router de Next.js y por lo tanto no heredan el
// basePath automáticamente como sí lo hacen `<Link>` / `useRouter()`.
export const BASE_PATH = "/admin/crm";
