// A app sob teste nunca usa o banco de desenvolvimento.
process.env.DB_NAME = process.env.DB_NAME_TEST ?? 'forge_test';
