/** Presentation restriction; database authorization remains handled by existing policies. */
export function canDisplayAdminTable(email: string | null | undefined, hasAdminRole: boolean): boolean {
  return hasAdminRole && email?.trim().toLowerCase() === "khadri1982@gmail.com";
}