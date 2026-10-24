// Errors carry an Azerbaijani, user-facing message plus a stable machine code.
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.statusCode = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Daxil olmaq tələb olunur.') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'Bu əməliyyat üçün icazəniz yoxdur.') => new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Tapılmadı.') => new HttpError(404, 'not_found', message);
export const conflict = (message, details) => new HttpError(409, 'conflict', message, details);

export function errorHandler(err, request, reply) {
  // Fastify schema validation errors
  if (err.validation) {
    return reply.status(400).send({ error: true, code: 'validation', message: 'Göndərilən məlumatlar yanlışdır.', details: err.validation });
  }
  // Postgres unique violation
  if (err.code === '23505') {
    const field = (err.constraint_name || err.constraint || '').replace(/_key$/, '').split('_').slice(1).join('_');
    return reply.status(409).send({ error: true, code: 'duplicate', message: `Bu dəyər artıq mövcuddur${field ? ` (${field})` : ''}.` });
  }
  if (err.code === '23503') {
    return reply.status(409).send({ error: true, code: 'in_use', message: 'Bu qeyd başqa məlumatlarla əlaqəlidir və silinə bilməz.' });
  }
  if (err.code === '23514') {
    return reply.status(400).send({ error: true, code: 'check', message: 'Dəyər icazə verilən aralıqda deyil.' });
  }
  if (err.statusCode === 429) {
    return reply.status(429).send({ error: true, code: 'rate_limited', message: 'Çox sayda sorğu göndərildi. Bir az sonra yenidən cəhd edin.' });
  }
  if (err instanceof HttpError || (err.statusCode && err.statusCode < 500)) {
    return reply.status(err.statusCode).send({ error: true, code: err.code || 'error', message: err.message, details: err.details });
  }
  request.log.error(err);
  return reply.status(500).send({ error: true, code: 'server_error', message: 'Serverdə gözlənilməz xəta baş verdi.' });
}
