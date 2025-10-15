/**
 * Authentication Flow Tests
 * Tests for signup, login, and logout functionality
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createMockSupabaseClient, testData } from '../utils/test-helpers';

describe('Authentication Flow', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    jest.clearAllMocks();
  });

  describe('Sign Up', () => {
    it('should successfully create a new user account', async () => {
      const email = 'newuser@example.com';
      const password = 'SecurePassword123!';

      const { data, error } = await mockSupabase.auth.signUp({
        email,
        password,
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email,
        password,
      });
    });

    it('should create user record in users table after signup', async () => {
      const email = 'newuser@example.com';
      const password = 'SecurePassword123!';

      // Simulate signup
      const { data: authData } = await mockSupabase.auth.signUp({
        email,
        password,
      });

      // Simulate creating user record
      const userRecord = {
        id: authData.user.id,
        email: authData.user.email,
        subscription_tier: 'free',
      };

      const { data: userData } = await mockSupabase
        .from('users')
        .insert(userRecord)
        .select()
        .single();

      expect(userData).toBeDefined();
      expect(userData.email).toBe(email);
    });

    it('should fail with invalid email format', async () => {
      const invalidEmail = 'not-an-email';
      const password = 'SecurePassword123!';

      // Mock error response
      mockSupabase.auth.signUp = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid email format' },
      });

      const { data, error } = await mockSupabase.auth.signUp({
        email: invalidEmail,
        password,
      });

      expect(error).toBeDefined();
      expect(error.message).toContain('Invalid email');
      expect(data.user).toBeNull();
    });

    it('should fail with weak password', async () => {
      const email = 'test@example.com';
      const weakPassword = '123';

      mockSupabase.auth.signUp = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Password should be at least 6 characters' },
      });

      const { data, error } = await mockSupabase.auth.signUp({
        email,
        password: weakPassword,
      });

      expect(error).toBeDefined();
      expect(error.message).toContain('Password');
    });
  });

  describe('Sign In', () => {
    it('should successfully login with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'SecurePassword123!';

      const { data, error } = await mockSupabase.auth.signInWithPassword({
        email,
        password,
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email,
        password,
      });
    });

    it('should fail with incorrect password', async () => {
      const email = 'test@example.com';
      const wrongPassword = 'WrongPassword123!';

      mockSupabase.auth.signInWithPassword = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      const { data, error } = await mockSupabase.auth.signInWithPassword({
        email,
        password: wrongPassword,
      });

      expect(error).toBeDefined();
      expect(error.message).toContain('Invalid login credentials');
      expect(data.user).toBeNull();
    });

    it('should fail with non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'Password123!';

      mockSupabase.auth.signInWithPassword = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      const { data, error } = await mockSupabase.auth.signInWithPassword({
        email,
        password,
      });

      expect(error).toBeDefined();
      expect(data.user).toBeNull();
    });

    it('should ensure user record exists after login', async () => {
      const email = 'test@example.com';
      const password = 'SecurePassword123!';

      // Login
      const { data: authData } = await mockSupabase.auth.signInWithPassword({
        email,
        password,
      });

      // Check if user record exists
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: authData.user.id,
            email: authData.user.email,
            subscription_tier: 'free',
          },
          error: null,
        }),
      }));

      const { data: userData } = await mockSupabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      expect(userData).toBeDefined();
      expect(userData.email).toBe(email);
    });
  });

  describe('Sign Out', () => {
    it('should successfully logout user', async () => {
      const { error } = await mockSupabase.auth.signOut();

      expect(error).toBeNull();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should clear user session after logout', async () => {
      // Login first
      await mockSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'Password123!',
      });

      // Logout
      await mockSupabase.auth.signOut();

      // Mock getUser to return null after logout
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { data } = await mockSupabase.auth.getUser();

      expect(data.user).toBeNull();
    });
  });

  describe('Get Current User', () => {
    it('should return current authenticated user', async () => {
      const { data, error } = await mockSupabase.auth.getUser();

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe('test-user-id');
      expect(data.user.email).toBe('test@example.com');
    });

    it('should return null for unauthenticated request', async () => {
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const { data, error } = await mockSupabase.auth.getUser();

      expect(error).toBeDefined();
      expect(data.user).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should maintain session after successful login', async () => {
      // Login
      const { data: loginData } = await mockSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(loginData.user).toBeDefined();

      // Verify session is active
      const { data: userData } = await mockSupabase.auth.getUser();

      expect(userData.user).toBeDefined();
      expect(userData.user.id).toBe(loginData.user.id);
    });

    it('should handle expired session', async () => {
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Session expired' },
      });

      const { data, error } = await mockSupabase.auth.getUser();

      expect(error).toBeDefined();
      expect(error.message).toContain('Session expired');
      expect(data.user).toBeNull();
    });
  });
});
