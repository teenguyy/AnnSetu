/** Copyright year, fixed at build time so prerendered pages never read the clock. */
export function Year() {
  return <>{process.env.NEXT_PUBLIC_BUILD_YEAR}</>;
}
