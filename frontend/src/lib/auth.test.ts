import { describe, it, expect, beforeAll } from 'vitest';
import { signIn } from './auth';

// Note: These tests are integration tests and require:
// 1. A running Supabase instance configured in .env
// 2. Network connectivity
// 3. The user 'user1@example.com' with password 'Password' to exist in Supabase Auth.

describe('signIn function (Integration Test)', () => {
  // Optional: Add setup here if needed, e.g., ensure user exists
  // beforeAll(async () => { ... });

  it('should log in successfully with correct credentials', async () => {
    const email = 'user1@example.com';
    const password = 'Password';

    // Call the actual signIn function
    const result = await signIn(email, password);

    // Assertions for a successful login with the real client
    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe(email);
    expect(result.session).toBeDefined();
  });

  it('should throw an error with incorrect credentials', async () => {
    const email = 'user1@example.com';
    const password = 'WrongPassword';

    // Expect the actual signIn function to throw an error for invalid credentials
    // The specific error message might differ from the mock, 
    // Supabase often throws AuthApiError
    await expect(signIn(email, password)).rejects.toThrowError(); 
    // Optional: Check for a more specific error type or message if known
    // await expect(signIn(email, password)).rejects.toThrowError(/Invalid login credentials/i); 
  });
});
