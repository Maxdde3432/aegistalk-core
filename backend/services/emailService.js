import { generateOTP, sendVerificationCode } from '../utils/emailService.js';

export { generateOTP };

export const sendVerificationEmail = async (email, code, purpose = 'registration') => {
  try {
    return await sendVerificationCode(email, code, purpose);
  } catch (error) {
    console.error('[Email] SMTP delivery error:', error);
    return { success: false, error: error.message };
  }
};

export const testEmailConfig = async () => true;
