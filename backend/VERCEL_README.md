## Vercel build instructions for backend

This branch adds `vercel-build` and `postinstall` scripts so that Prisma client is generated and migrations are applied during the Vercel build step.

When creating the Vercel project for the backend, set the following Build & Development Settings:

- Root Directory: backend
- Build Command: npm run vercel-build
- Output Directory: dist

Set the following Environment Variables (Preview + Production as appropriate):
- DATABASE_URL: (Neon/Postgres connection string)
- JWT_SECRET: (>= 32 chars)
- FRONTEND_URL: https://hkfe.vercel.app
- EMAIL_SERVICE: console (for preview/testing)

After setting envs, redeploy the project.
