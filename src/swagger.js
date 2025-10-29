// OpenAPI 3.0 spec for feru-backend
// Minimal manual spec without swagger-jsdoc

const servers = [
  { url: 'https://api.feru.app', description: 'FERU API' }
];

const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT'
  }
};

const components = {
  securitySchemes,
  schemas: {
    ErrorResponse: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' }
      }
    },
    AuthTokens: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' }
      },
      required: ['accessToken', 'refreshToken']
    },
    User: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        user_type: { type: 'string', enum: ['FREE'] }
      }
    },
    LighthouseJobResult: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        region: { type: 'string' },
        status: { type: 'string', enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] },
        created_at: { type: 'string', format: 'date-time' },
        s3_report_url: { type: 'string', nullable: true },
        metrics: {
          type: 'object',
          properties: {
            lcp: { type: 'number', nullable: true },
            fcp: { type: 'number', nullable: true },
            cls: { type: 'number', nullable: true },
            tbt: { type: 'number', nullable: true },
            tti: { type: 'number', nullable: true },
            ttfb: { type: 'number', nullable: true },
            performance_score: { type: 'number', nullable: true }
          }
        }
      }
    }
  }
};

const authPaths = {
  '/auth/me': {
    get: {
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Get current authenticated user',
      responses: {
        200: {
          description: 'Current user',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } }
            }
          }
        },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
      }
    }
  },
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { refreshToken: { type: 'string' } },
              required: ['refreshToken']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'New tokens',
          content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } } } } }
        },
        401: { description: 'Invalid or expired refresh token' }
      }
    }
  },
  '/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' },
                name: { type: 'string' }
              },
              required: ['email', 'password', 'name']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Registered user and tokens',
          content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' }, tokens: { $ref: '#/components/schemas/AuthTokens' } } } } }
        },
        400: { description: 'Validation error' }
      }
    }
  },
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' }
              },
              required: ['email', 'password']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'User and tokens',
          content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' }, tokens: { $ref: '#/components/schemas/AuthTokens' } } } } }
        },
        401: { description: 'Invalid credentials' }
      }
    }
  }
};

const lighthousePaths = {
  '/lighthouse/all': {
    get: {
      tags: ['Lighthouse'],
      security: [{ bearerAuth: [] }],
      summary: 'List all lighthouse jobs for current user',
      responses: {
        200: { description: 'List of jobs', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
        401: { description: 'Unauthorized' }
      }
    }
  },
  '/lighthouse/{id}': {
    get: {
      tags: ['Lighthouse'],
      summary: 'Get results by job id',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        200: {
          description: 'Job results',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  url: { type: 'string' },
                  device: { type: 'string' },
                  ip: { type: 'string', nullable: true },
                  username: { type: 'string', nullable: true },
                  created_at: { type: 'string', format: 'date-time' },
                  completed_at: { type: 'string', format: 'date-time', nullable: true },
                  results: { type: 'array', items: { $ref: '#/components/schemas/LighthouseJobResult' } }
                }
              }
            }
          }
        },
        404: { description: 'Not found' }
      }
    }
  },
  '/lighthouse': {
    post: {
      tags: ['Lighthouse'],
      summary: 'Create and start a new lighthouse audit',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                device: { type: 'string', enum: ['mobile', 'desktop'] },
                region: { type: 'string', description: 'Comma-separated AWS regions' }
              },
              required: ['url', 'device', 'region']
            }
          }
        }
      },
      responses: {
        201: { description: 'Job created', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' } } } } } },
        400: { description: 'Validation error' }
      }
    }
  },
  '/lighthouse/system/webhook': {
    post: {
      tags: ['Lighthouse'],
      summary: 'Webhook to update lighthouse results (internal)',
      parameters: [
        { name: 'x-lh-secret', in: 'header', required: true, schema: { type: 'string' } }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                result_id: { type: 'string' },
                status: { type: 'string', enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] },
                region: { type: 'string' },
                s3_report_url: { type: 'string' },
                s3_metrics_json_url: { type: 'string' },
                fcp: { type: 'number' },
                lcp: { type: 'number' },
                cls: { type: 'number' },
                tbt: { type: 'number' },
                tti: { type: 'number' },
                ttfb: { type: 'number' },
                performance_score: { type: 'number' }
              },
              required: ['result_id', 'status']
            }
          }
        }
      },
      responses: {
        200: { description: 'Updated' },
        403: { description: 'Forbidden' }
      }
    }
  }
};

const monitoringPaths = {
  '/monitoring': {
    get: {
      tags: ['Monitoring'],
      security: [{ bearerAuth: [] }],
      summary: 'List monitoring entries for current user',
      responses: {
        200: { description: 'List of monitoring entries', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
        401: { description: 'Unauthorized' }
      }
    },
    post: {
      tags: ['Monitoring'],
      security: [{ bearerAuth: [] }],
      summary: 'Create a monitoring entry',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                device: { type: 'string', enum: ['mobile', 'desktop'] },
                regions: { type: 'array', items: { type: 'string' } },
                type: { type: 'string' },
                interval: { type: 'string', description: 'e.g. daily, hourly' }
              },
              required: ['url', 'device', 'regions', 'interval']
            }
          }
        }
      },
      responses: {
        201: { description: 'Created' },
        401: { description: 'Unauthorized' },
        400: { description: 'Validation error' }
      }
    }
  },
  '/monitoring/{id}': {
    delete: {
      tags: ['Monitoring'],
      security: [{ bearerAuth: [] }],
      summary: 'Delete monitoring entry',
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      responses: {
        200: { description: 'Deleted' },
        401: { description: 'Unauthorized' },
        404: { description: 'Not found' }
      }
    }
  }
};

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Feru Backend API',
    version: '1.0.0'
  },
  servers,
  components,
  paths: {
    // ...authPaths,
    ...lighthousePaths,
    ...monitoringPaths
  }
};

module.exports = openapi;


