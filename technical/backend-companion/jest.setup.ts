// Ensure required env vars are present for modules that load config during unit tests.
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://companion:companion@localhost:5432/companion_test?schema=public";
process.env.JWT_SECRET ??= "test-jwt-secret-32-characters-min!!";
process.env.INTERNAL_API_TOKEN ??= "test-internal-token";
