export interface PermissionState {
  signedIn: boolean;
  unrestrictedAdmin: boolean;
  individualOnly: boolean;
  hasCustomPermissions: boolean;
  permissions: ReadonlySet<string>;
  pdvPermissions: ReadonlySet<string> | null;
  pdvDenied: ReadonlySet<string>;
}

/** Configured user rights form a whitelist; a PDV denial cannot grant a right. */
export function hasEffectivePermission(state: PermissionState, key: string): boolean {
  if (!state.signedIn) return false;
  if (state.unrestrictedAdmin) return true;
  if (state.individualOnly) return state.permissions.has(key);
  if (state.pdvDenied.has(key)) return false;
  if (state.hasCustomPermissions) return state.permissions.has(key);
  return state.pdvPermissions?.has(key) ?? false;
}