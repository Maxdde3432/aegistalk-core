import crypto from 'crypto';
import { query } from '../db/index.js';

const CODE_PREFIX = 'aegis-vrf-';
const RANDOM_BYTES_LENGTH = 6; // 12 hex symbols

export const generateVerificationCode = () => {
  return `${CODE_PREFIX}${crypto.randomBytes(RANDOM_BYTES_LENGTH).toString('hex')}`;
};

export const assignUniqueVerificationCode = async (groupId, status = 'idle', attempts = 5) => {
  let lastError;

  for (let i = 0; i < attempts; i++) {
    const code = generateVerificationCode();
    try {
      const result = await query(
        `UPDATE groups
           SET verification_code = $1,
               site_verification_status = $2,
               updated_at = NOW()
         WHERE id = $3
       RETURNING verification_code, site_verification_status`,
        [code, status, groupId]
      );

      if (result.rowCount > 0) {
        return result.rows[0];
      }
    } catch (error) {
      // Unique violation, try again with a new random value
      if (error.code === '23505') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Unable to generate unique verification code');
};
