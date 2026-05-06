/**
 * Contract schemas — описывают форматы ответов API которые ожидает фронт.
 * Используются в api-contracts.test.js для валидации ответов бэкенда.
 *
 * Источник правды: frontend/app.js + docs/audit/frontend-api-usage.md
 */

const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, strict: false });

// ─── Schemas ──────────────────────────────────────────────────────────────────

const schemas = {

  // POST /api/auth/login → { token, username }
  loginResponse: {
    type: 'object',
    required: ['token', 'username'],
    properties: {
      token:    { type: 'string', minLength: 1 },
      username: { type: 'string', minLength: 1 },
    },
    additionalProperties: true,
  },

  // GET /api/auth/me → { username }
  authMeResponse: {
    type: 'object',
    required: ['username'],
    properties: {
      username: { type: 'string', minLength: 1 },
    },
    additionalProperties: true,
  },

  // POST /api/auth/join → { token }
  joinResponse: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string', minLength: 1 },
    },
    additionalProperties: true,
  },

  // GET /api/conversations → массив
  conversationsList: {
    type: 'array',
    items: {
      type: 'object',
      required: ['id'],
      properties: {
        id:    { type: 'string' },
        title: { type: 'string' },
      },
      additionalProperties: true,
    },
  },

  // POST /api/conversations → { id }
  createConversation: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 1 },
    },
    additionalProperties: true,
  },

  // GET /api/conversations/:id → { messages: [] }
  conversationDetail: {
    type: 'object',
    required: ['messages'],
    properties: {
      messages: {
        type: 'array',
        items: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role:    { type: 'string' },
            content: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
    },
    additionalProperties: true,
  },

  // POST /api/conversations/:id/messages → { id }
  saveMessage: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 1 },
    },
    additionalProperties: true,
  },

  // GET /api/conversations/memory → { is_onboarded: boolean }
  memoryResponse: {
    type: 'object',
    required: ['is_onboarded'],
    properties: {
      is_onboarded: { type: 'boolean' },
    },
    additionalProperties: true,
  },

  // POST /api/sessions/start → { sessionId }
  sessionStart: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string', minLength: 1 },
    },
    additionalProperties: true,
  },

  // POST /api/sessions/end → { success: true }
  sessionEnd: {
    type: 'object',
    required: ['success'],
    properties: {
      success: { type: 'boolean', enum: [true] },
    },
    additionalProperties: true,
  },
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Валидирует данные по схеме. Бросает Error если данные не соответствуют.
 * @param {object} schema - JSON Schema объект
 * @param {any}    data   - данные для валидации
 * @throws {Error} если данные не соответствуют схеме
 */
function validate(schema, data) {
  const valid = ajv.validate(schema, data);
  if (!valid) {
    const errors = ajv.errorsText(ajv.errors, { separator: '; ' });
    throw new Error(`Schema validation failed: ${errors}\nData: ${JSON.stringify(data, null, 2)}`);
  }
}

module.exports = { schemas, validate };
