import request from 'supertest';
import app from '../../src/index';
import { prismaMock, createMockUser, clearDatabase } from '../setup';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Authentication API Integration Tests', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser123',
        password: 'SecurePass123!'
      };

      const mockUser = createMockUser({
        email: userData.email,
        username: userData.username,
        password: 'hashedPassword'
      });

      prismaMock.user.findUnique.mockResolvedValue(null); // User doesn't exist
      prismaMock.user.create.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          role: mockUser.role
        }
      });

      expect(response.body.token).toBeDefined();
      expect(response.body.user.password).toBeUndefined();

      // Verify database calls
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: userData.email }
      });
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          username: userData.username,
          password: expect.any(String) // Hashed password
        }
      });
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        username: 'testuser123',
        password: 'SecurePass123!'
      };

      const existingUser = createMockUser({ email: userData.email });
      prismaMock.user.findUnique.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'User already exists with this email'
      });

      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('should reject registration with invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        username: 'testuser123',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual({
        field: 'email',
        message: 'Invalid email format'
      });
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser123',
        password: 'weak'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'password',
          message: expect.stringContaining('Password must')
        })
      );
    });

    it('should reject registration with invalid username', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'test user!', // Contains space and special char
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual({
        field: 'username',
        message: 'Username can only contain letters, numbers, and underscores'
      });
    });

    it('should handle database errors gracefully', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser123',
        password: 'SecurePass123!'
      };

      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal server error'
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      const hashedPassword = await bcrypt.hash(loginData.password, 10);
      const mockUser = createMockUser({
        email: loginData.email,
        password: hashedPassword
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          role: mockUser.role
        }
      });

      expect(response.body.token).toBeDefined();
      expect(response.body.user.password).toBeUndefined();

      // Verify JWT token
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
    });

    it('should reject login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!'
      };

      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Invalid credentials'
      });
    });

    it('should reject login with incorrect password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      const mockUser = createMockUser({
        email: loginData.email,
        password: hashedPassword
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Invalid credentials'
      });
    });

    it('should reject login for inactive user', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      const hashedPassword = await bcrypt.hash(loginData.password, 10);
      const mockUser = createMockUser({
        email: loginData.email,
        password: hashedPassword,
        isActive: false
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Account is deactivated'
      });
    });

    it('should validate login input', async () => {
      const loginData = {
        email: 'invalid-email',
        password: ''
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual({
        field: 'email',
        message: 'Invalid email format'
      });
      expect(response.body.details).toContainEqual({
        field: 'password',
        message: 'Password is required'
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      const mockUser = createMockUser();
      const token = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logout successful'
      });
    });

    it('should handle logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Access token required'
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      const mockUser = createMockUser();
      const token = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          role: mockUser.role
        }
      });

      expect(response.body.user.password).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Access token required'
      });
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Invalid token'
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Make multiple requests to trigger rate limiting
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(requests);
      
      // First 5 should be processed (even if they fail auth)
      // 6th should be rate limited
      const rateLimitedResponse = responses[5];
      expect(rateLimitedResponse?.status).toBe(429);
      expect(rateLimitedResponse?.body.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
    });
  });
});
