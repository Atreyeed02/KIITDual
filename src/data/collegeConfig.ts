/**
 * KIITDual — College Domain Configuration
 * Configurable list of allowed student email domains.
 */

export interface CollegeConfig {
  collegeName: string;
  allowedDomains: string[];
  defaultDomain: string;
  emailPlaceholder: string;
}

export const KIIT_COLLEGE_CONFIG: CollegeConfig = {
  collegeName: 'Kalinga Institute of Industrial Technology (KIIT)',
  allowedDomains: ['kiit.ac.in', 'college.edu', 'university.edu', 'mit.edu', 'stanford.edu'],
  defaultDomain: 'kiit.ac.in',
  emailPlaceholder: 'roll_number@kiit.ac.in',
};

/**
 * Validates whether an email string belongs to an allowed college domain
 */
export function validateCollegeEmail(email: string): { isValid: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase();
  
  if (!trimmed) {
    return { isValid: false, error: 'Please enter your college email address' };
  }

  // Basic format regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  const domain = trimmed.split('@')[1];
  const isAllowed = KIIT_COLLEGE_CONFIG.allowedDomains.some((d) =>
    domain === d || domain.endsWith('.' + d)
  );

  if (!isAllowed) {
    return {
      isValid: false,
      error: `Please use your official college email (@${KIIT_COLLEGE_CONFIG.defaultDomain})`,
    };
  }

  return { isValid: true };
}
