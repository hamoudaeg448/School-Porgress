# School Progress

Next.js + Prisma + MySQL. Tracks student results by subject, term and year.

## Run locally
1. `cp .env.example .env` and fill in `DATABASE_URL` and `SESSION_SECRET`
2. `npm install`
3. `npm run db:push`   (creates the tables)
4. `npm run db:seed`   (admin user, 2026-2027 year, 3 terms, sample subjects)
5. `npm run dev` then open http://localhost:3000

## Deploy on Hostinger (Node.js web app)
1. Push this folder to a GitHub repository.
2. hPanel > Websites > Add Website > Node.js web app, then pick the repo.
3. Choose Node 22 (or 20).
4. Add environment variables: `DATABASE_URL`, `SESSION_SECRET`.
   Use the connection details of the managed MySQL database shown in hPanel.
5. Create the tables once: either enable Remote MySQL for your IP in hPanel and run
   `npm run db:push && npm run db:seed` from your computer with the production
   `DATABASE_URL`, or run those commands in the Hostinger terminal if your plan offers one.
6. Open the site and sign in with the seeded admin account, then change the password.

## Structure
- `prisma/schema.prisma`: data model (students, subjects, terms, assessments, results, import log)
- `src/lib/auth.js`: signed-cookie sessions; `src/middleware.js` protects `/dashboard`
- `src/app/`: login, dashboard (overview, classes) and server actions

## Next steps
Student list import from Excel (IDs kept as text, e.g. 0001), score import with column mapping and validation, then charts.
