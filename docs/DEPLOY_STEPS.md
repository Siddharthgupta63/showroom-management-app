# Showroom DMS – Deployment Steps

This project uses:

- Frontend: Next.js
- Backend: Node.js + Express
- Database: MySQL
- Process manager: PM2
- Server: AWS Lightsail Ubuntu

Project paths:

- Local Mac: `~/Documents/GitHub/showroom-management-app`
- Server: `~/showroom-management-app`

---

## 1. Connect to server

From Mac:

```bash
ssh -i "/Users/sidmac/Desktop/backup/LightsailDefaultKey-ap-south-1.pem" ubuntu@3.111.128.54
2. Normal deployment flow

Use this when code is already pushed to GitHub.

cd ~/showroom-management-app
git pull

cd backend
npm install
npm run migrate
pm2 restart showroom-backend

cd ../frontend
npm install
npm run build
pm2 restart showroom-frontend
3. Check PM2 status
pm2 list
4. Check logs

Backend:

pm2 logs showroom-backend --lines 100

Frontend:

pm2 logs showroom-frontend --lines 100

Stop logs with:

Ctrl + C
5. Database backup before important deployment

Use before major backend / DB changes.

mkdir -p ~/db_backups
sudo mysqldump showroom_db > ~/db_backups/showroom_db_$(date +%F_%H-%M-%S).sql
6. Local Git workflow

From Mac:

cd ~/Documents/GitHub/showroom-management-app
git status
git add .
git commit -m "your message"
git push origin main
7. Migration system

Database migrations are stored in:

backend/migrations/

Migration runner:

backend/scripts/runMigrations.js

Run manually in backend:

npm run migrate

Migration tracking table:

schema_migrations
8. Rule for DB changes

Whenever database structure or DB logic changes:

Create a new SQL file in backend/migrations/

Use the next number in sequence

Commit code + migration together

Push to GitHub

On server run npm run migrate

Example filenames:

005_seed_nominee_relation_dropdowns.sql
006_add_sales_index.sql
007_create_new_view.sql
9. Important migration rules
Do not edit old migrations after deployment

Do not change already-used files like:

000_schema_migrations.sql

002_create_incentives_table.sql

003_tyre_shop_schema.sql

004_create_or_replace_insurance_combined_view_v2.sql

Always create a new migration file.

Next migration number

Use the next available number, for example:

005_...
10. Startup view safety

Backend also auto-ensures important SQL views at startup using:

backend/utils/ensureViews.js

This is only a safety layer.

Still use migration files for official DB changes.

11. If backend deploy fails

Try:

cd ~/showroom-management-app/backend
npm install
npm run migrate
pm2 restart showroom-backend
pm2 logs showroom-backend --lines 100
12. If frontend deploy fails

Try:

cd ~/showroom-management-app/frontend
npm install
npm run build
pm2 restart showroom-frontend
pm2 logs showroom-frontend --lines 100
13. Full safe production deployment checklist
On Mac
cd ~/Documents/GitHub/showroom-management-app
git status
git add .
git commit -m "your message"
git push origin main
On server
ssh -i "/Users/sidmac/Desktop/backup/LightsailDefaultKey-ap-south-1.pem" ubuntu@3.111.128.54

mkdir -p ~/db_backups
sudo mysqldump showroom_db > ~/db_backups/showroom_db_$(date +%F_%H-%M-%S).sql

cd ~/showroom-management-app
git pull

cd backend
npm install
npm run migrate
pm2 restart showroom-backend

cd ../frontend
npm install
npm run build
pm2 restart showroom-frontend

pm2 list
14. Current PM2 process names

Backend:

showroom-backend

Frontend:

showroom-frontend
15. Notes

npm audit warnings can be handled later

baseline-browser-mapping warning does not block build

Always test important flows after deployment:

Sales

Insurance

Pipeline

Dropdowns

Purchases

Vehicle flow


After saving it, run:

```bash
cd ~/Documents/GitHub/showroom-management-app
git add DEPLOY_STEPS.md
git commit -m "Add deployment guide"
git push origin main