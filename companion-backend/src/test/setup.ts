process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ||= 'error';
process.env.DATABASE_URL ||= 'postgresql://rhythmkhanna@localhost:5433/companion_test';
process.env.JWT_SECRET ||= 'test-jwt-secret-123456789012345678901234567890';
process.env.MOCK_PAYMENT_DELAY_MS ||= '0';
process.env.MOCK_SMS_ENABLED ||= 'true';
