import { Request, Response, NextFunction } from 'express';
import { 
  validateSchema, 
  sanitizeInput,
  userRegistrationSchema,
  userLoginSchema,
  postSchema,
  contentGenerationSchema
} from '../../../src/middleware/validation';
import { 
  createMockRequest, 
  createMockResponse, 
  createMockNext 
} from '../../setup';

describe('Validation Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  describe('validateSchema', () => {
    describe('userRegistrationSchema', () => {
      const middleware = validateSchema(userRegistrationSchema);

      it('should pass validation with valid user registration data', () => {
        req.body = {
          email: 'test@example.com',
          username: 'testuser123',
          password: 'SecurePass123!'
        };

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.body).toEqual({
          email: 'test@example.com',
          username: 'testuser123',
          password: 'SecurePass123!'
        });
      });

      it('should reject invalid email format', () => {
        req.body = {
          email: 'invalid-email',
          username: 'testuser123',
          password: 'SecurePass123!'
        };

        middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: 'Invalid email format'
            })
          ])
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should reject weak password', () => {
        req.body = {
          email: 'test@example.com',
          username: 'testuser123',
          password: 'weak'
        };

        middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'password',
              message: expect.stringContaining('Password must')
            })
          ])
        });
      });

      it('should reject invalid username format', () => {
        req.body = {
          email: 'test@example.com',
          username: 'test user!', // Contains space and special char
          password: 'SecurePass123!'
        };

        middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'username',
              message: 'Username can only contain letters, numbers, and underscores'
            })
          ])
        });
      });
    });

    describe('userLoginSchema', () => {
      const middleware = validateSchema(userLoginSchema);

      it('should pass validation with valid login data', () => {
        req.body = {
          email: 'test@example.com',
          password: 'password123'
        };

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
      });

      it('should reject missing password', () => {
        req.body = {
          email: 'test@example.com'
        };

        middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('postSchema', () => {
      const middleware = validateSchema(postSchema);

      it('should pass validation with valid post data', () => {
        req.body = {
          content: 'This is a test post #crypto',
          mediaUrls: ['https://example.com/image.jpg'],
          hashtags: ['#crypto', '#bitcoin'],
          mentions: ['@testuser'],
          scheduledFor: new Date().toISOString()
        };

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
      });

      it('should reject content exceeding 280 characters', () => {
        req.body = {
          content: 'a'.repeat(281), // 281 characters
          mediaUrls: [],
          hashtags: [],
          mentions: []
        };

        middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'content',
              message: 'Content cannot exceed 280 characters'
            })
          ])
        });
      });

      it('should reject more than 4 media URLs', () => {
        req.body = {
          content: 'Test post',
          mediaUrls: [
            'https://example.com/1.jpg',
            'https://example.com/2.jpg',
            'https://example.com/3.jpg',
            'https://example.com/4.jpg',
            'https://example.com/5.jpg'
          ],
          hashtags: [],
          mentions: []
        };

        middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should reject invalid hashtag format', () => {
        req.body = {
          content: 'Test post',
          mediaUrls: [],
          hashtags: ['invalid-hashtag'], // Missing #
          mentions: []
        };

        middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('contentGenerationSchema', () => {
      const middleware = validateSchema(contentGenerationSchema);

      it('should pass validation with valid content generation data', () => {
        req.body = {
          topic: 'Bitcoin market analysis',
          tone: 'professional',
          contentType: 'market_analysis',
          platform: 'x',
          length: 'medium',
          includeHashtags: true,
          includeMentions: false
        };

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
      });

      it('should apply default values', () => {
        req.body = {
          topic: 'Bitcoin news',
          tone: 'casual',
          contentType: 'post'
        };

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.body.platform).toBe('x');
        expect(req.body.length).toBe('medium');
        expect(req.body.includeHashtags).toBe(true);
        expect(req.body.includeMentions).toBe(false);
      });

      it('should reject invalid tone', () => {
        req.body = {
          topic: 'Bitcoin news',
          tone: 'invalid-tone',
          contentType: 'post'
        };

        middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize malicious script tags from body', () => {
      req.body = {
        content: '<script>alert("xss")</script>Hello world',
        title: 'Normal title'
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.content).toBe('Hello world');
      expect(req.body.title).toBe('Normal title');
      expect(next).toHaveBeenCalledWith();
    });

    it('should sanitize javascript: protocols', () => {
      req.body = {
        url: 'javascript:alert("xss")',
        link: 'https://example.com'
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.url).toBe('alert("xss")');
      expect(req.body.link).toBe('https://example.com');
    });

    it('should sanitize event handlers', () => {
      req.body = {
        content: '<div onclick="alert()">Content</div>'
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.content).toBe('<div>Content</div>');
    });

    it('should sanitize nested objects', () => {
      req.body = {
        user: {
          name: '<script>alert("xss")</script>John',
          profile: {
            bio: 'javascript:void(0)'
          }
        }
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.user.name).toBe('John');
      expect(req.body.user.profile.bio).toBe('void(0)');
    });

    it('should sanitize arrays', () => {
      req.body = {
        tags: ['<script>alert()</script>tag1', 'normal-tag', 'javascript:alert()']
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.tags).toEqual(['tag1', 'normal-tag', 'alert()']);
    });

    it('should sanitize query parameters', () => {
      req.query = {
        search: '<script>alert("xss")</script>bitcoin',
        filter: 'normal'
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.query.search).toBe('bitcoin');
      expect(req.query.filter).toBe('normal');
    });

    it('should trim whitespace', () => {
      req.body = {
        content: '  Hello world  ',
        title: '\t\nTitle\n\t'
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.content).toBe('Hello world');
      expect(req.body.title).toBe('Title');
    });
  });
});
