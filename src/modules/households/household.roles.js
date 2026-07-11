export const HOUSEHOLD_ROLES = Object.freeze({
  OWNER: 1,
  ADMIN: 2,
  EDITOR: 3,
  VIEWER: 4,
});

export const HOUSEHOLD_PERMISSIONS = Object.freeze({
  HOUSEHOLD_VIEW: 'household:view',
  HOUSEHOLD_UPDATE: 'household:update',
  HOUSEHOLD_DELETE: 'household:delete',
  HOUSEHOLD_TRANSFER_OWNERSHIP: 'household:transfer-ownership',
  MEMBERS_VIEW: 'members:view',
  MEMBERS_MANAGE: 'members:manage',
  ACCOUNTS_VIEW: 'accounts:view',
  ACCOUNTS_MANAGE: 'accounts:manage',
  CATEGORIES_VIEW: 'categories:view',
  CATEGORIES_MANAGE: 'categories:manage',
  TRANSACTIONS_VIEW: 'transactions:view',
  TRANSACTIONS_MANAGE: 'transactions:manage',
  BUDGETS_VIEW: 'budgets:view',
  BUDGETS_MANAGE: 'budgets:manage',
  AUDIT_VIEW: 'audit:view',
});

export const HOUSEHOLD_PERMISSION_LABELS = Object.freeze({
  [HOUSEHOLD_PERMISSIONS.HOUSEHOLD_VIEW]: 'Ver el espacio financiero',
  [HOUSEHOLD_PERMISSIONS.HOUSEHOLD_UPDATE]: 'Editar la configuración del espacio',
  [HOUSEHOLD_PERMISSIONS.HOUSEHOLD_DELETE]: 'Eliminar el espacio',
  [HOUSEHOLD_PERMISSIONS.HOUSEHOLD_TRANSFER_OWNERSHIP]: 'Transferir la propiedad',
  [HOUSEHOLD_PERMISSIONS.MEMBERS_VIEW]: 'Ver integrantes',
  [HOUSEHOLD_PERMISSIONS.MEMBERS_MANAGE]: 'Administrar integrantes y roles',
  [HOUSEHOLD_PERMISSIONS.ACCOUNTS_VIEW]: 'Ver cuentas',
  [HOUSEHOLD_PERMISSIONS.ACCOUNTS_MANAGE]: 'Administrar cuentas',
  [HOUSEHOLD_PERMISSIONS.CATEGORIES_VIEW]: 'Ver categorías',
  [HOUSEHOLD_PERMISSIONS.CATEGORIES_MANAGE]: 'Administrar categorías',
  [HOUSEHOLD_PERMISSIONS.TRANSACTIONS_VIEW]: 'Ver movimientos',
  [HOUSEHOLD_PERMISSIONS.TRANSACTIONS_MANAGE]: 'Administrar movimientos',
  [HOUSEHOLD_PERMISSIONS.BUDGETS_VIEW]: 'Ver presupuestos',
  [HOUSEHOLD_PERMISSIONS.BUDGETS_MANAGE]: 'Administrar presupuestos',
  [HOUSEHOLD_PERMISSIONS.AUDIT_VIEW]: 'Consultar auditoría',
});

const ALL_PERMISSIONS = Object.freeze(Object.values(HOUSEHOLD_PERMISSIONS));

const ADMIN_PERMISSIONS = Object.freeze(
  ALL_PERMISSIONS.filter(
    (permission) =>
      permission !== HOUSEHOLD_PERMISSIONS.HOUSEHOLD_DELETE &&
      permission !== HOUSEHOLD_PERMISSIONS.HOUSEHOLD_TRANSFER_OWNERSHIP,
  ),
);

const EDITOR_PERMISSIONS = Object.freeze([
  HOUSEHOLD_PERMISSIONS.HOUSEHOLD_VIEW,
  HOUSEHOLD_PERMISSIONS.MEMBERS_VIEW,
  HOUSEHOLD_PERMISSIONS.ACCOUNTS_VIEW,
  HOUSEHOLD_PERMISSIONS.ACCOUNTS_MANAGE,
  HOUSEHOLD_PERMISSIONS.CATEGORIES_VIEW,
  HOUSEHOLD_PERMISSIONS.CATEGORIES_MANAGE,
  HOUSEHOLD_PERMISSIONS.TRANSACTIONS_VIEW,
  HOUSEHOLD_PERMISSIONS.TRANSACTIONS_MANAGE,
  HOUSEHOLD_PERMISSIONS.BUDGETS_VIEW,
  HOUSEHOLD_PERMISSIONS.BUDGETS_MANAGE,
]);

const VIEWER_PERMISSIONS = Object.freeze([
  HOUSEHOLD_PERMISSIONS.HOUSEHOLD_VIEW,
  HOUSEHOLD_PERMISSIONS.MEMBERS_VIEW,
  HOUSEHOLD_PERMISSIONS.ACCOUNTS_VIEW,
  HOUSEHOLD_PERMISSIONS.CATEGORIES_VIEW,
  HOUSEHOLD_PERMISSIONS.TRANSACTIONS_VIEW,
  HOUSEHOLD_PERMISSIONS.BUDGETS_VIEW,
]);

export const HOUSEHOLD_ROLE_MATRIX = Object.freeze({
  [HOUSEHOLD_ROLES.OWNER]: Object.freeze({
    key: 'OWNER',
    label: 'Propietario',
    permissions: ALL_PERMISSIONS,
  }),
  [HOUSEHOLD_ROLES.ADMIN]: Object.freeze({
    key: 'ADMIN',
    label: 'Administrador',
    permissions: ADMIN_PERMISSIONS,
  }),
  [HOUSEHOLD_ROLES.EDITOR]: Object.freeze({
    key: 'EDITOR',
    label: 'Editor',
    permissions: EDITOR_PERMISSIONS,
  }),
  [HOUSEHOLD_ROLES.VIEWER]: Object.freeze({
    key: 'VIEWER',
    label: 'Solo lectura',
    permissions: VIEWER_PERMISSIONS,
  }),
});

export function isValidHouseholdRole(role) {
  return Number.isInteger(role) && Boolean(HOUSEHOLD_ROLE_MATRIX[role]);
}

export function getHouseholdRole(role) {
  const definition = HOUSEHOLD_ROLE_MATRIX[role];

  if (!definition) {
    return null;
  }

  return Object.freeze({
    id: role,
    key: definition.key,
    label: definition.label,
  });
}

export function getPermissionsForRole(role) {
  return HOUSEHOLD_ROLE_MATRIX[role]?.permissions ?? Object.freeze([]);
}

export function roleHasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

export function getPermissionEntriesForRole(role) {
  return getPermissionsForRole(role).map((permission) => ({
    key: permission,
    label: HOUSEHOLD_PERMISSION_LABELS[permission] ?? permission,
  }));
}
