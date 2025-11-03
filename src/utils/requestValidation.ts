import { UserRole } from '../types';

/**
 * Validates if a user role can create requests in a specific table
 */
export const validateRequestPermission = (userRole: UserRole, targetTable: string): boolean => {
  const roleTableMap: Record<UserRole, string[]> = {
    'DirectShowroomManager': ['dsreqs'],
    'DirectShowroomStaff': ['dsreqs'],
    'DirectRepresentative': ['drreqs'],
    'Distributor': ['distributorReqs'],
    'DistributorRepresentative': ['disRefReqs'],
    'HeadOfOperations': [], // Can approve but not create
    'MainDirector': [], // Can approve but not create
    'Admin': [] // Can approve but not create
  };

  const allowedTables = roleTableMap[userRole] || [];
  
  // For DisRef requests, we need to check if the table starts with disRefReqs
  if (userRole === 'DistributorRepresentative') {
    return targetTable.startsWith('disRefReqs/');
  }
  
  return allowedTables.includes(targetTable);
};

/**
 * Gets the correct request table path for a user role
 */
export const getRequestTableForRole = (userRole: UserRole, userData?: any): string => {
  switch (userRole) {
    case 'DirectShowroomManager':
    case 'DirectShowroomStaff':
      return 'dsreqs';
    case 'DirectRepresentative':
      return 'drreqs';
    case 'Distributor':
      return 'distributorReqs';
    case 'DistributorRepresentative':
      if (!userData?.distributorId) {
        throw new Error('DistributorRepresentative requests require distributorId in user profile');
      }
      return `disRefReqs/${userData.distributorId}`;
    default:
      throw new Error(`Role ${userRole} cannot create requests`);
  }
};

/**
 * Validates request data before submission
 */
export const validateRequestData = (data: any, userRole: UserRole): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check required fields
  if (!data.requestedBy) {
    errors.push('requestedBy is required');
  }

  if (!data.requestedByName) {
    errors.push('requestedByName is required');
  }

  if (!data.requestedByRole) {
    errors.push('requestedByRole is required');
  }

  if (!data.items || Object.keys(data.items).length === 0) {
    errors.push('At least one item is required');
  }

  // Validate role consistency
  if (data.requestedByRole !== userRole) {
    errors.push('User role does not match request role');
  }

  // Validate status
  if (!data.status) {
    errors.push('Status is required');
  }

  // Validate timestamps
  if (!data.createdAt) {
    errors.push('createdAt timestamp is required');
  }

  if (!data.updatedAt) {
    errors.push('updatedAt timestamp is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};