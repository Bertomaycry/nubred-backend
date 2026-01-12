# Quick Start Guide - Prisma Migration

## 🚀 Get Started in 5 Minutes

### Step 1: Switch to Migration Branch
```bash
cd Nubred-backend
git checkout mongoose-conversion
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
Ensure your `.env.dev` file exists with:
```env
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
DB_NAME=nubred-dev
ACCESS_TOKEN_SECRET_KEY=your_secret
REFRESH_TOKEN_SECRET_KEY=your_secret
```

### Step 4: Generate Prisma Client
```bash
npx prisma generate
```

### Step 5: Start the Server
```bash
npm run dev
```

You should see:
```
✅ Connected to DB: nubred-dev via Prisma
🌐 Server running on port 5000
```

## ✅ That's It!

Your backend is now running with Prisma. All APIs work exactly as before.

### Need Help?
- Read the full guide: [PRISMA_MIGRATION_GUIDE.md](./PRISMA_MIGRATION_GUIDE.md)
- Check Prisma docs: https://www.prisma.io/docs

### Common Commands
```bash
# View database
npx prisma studio

# Seed admin user
node src/seeders/seedAdmin.js

# Run tests
npm test
```

## 🔥 What Changed?

- ✅ Mongoose → Prisma ORM
- ✅ All APIs remain the same
- ✅ Better performance & type safety
- ✅ Fixed chat history bugs
- ✅ No frontend changes needed

## 📊 Test the APIs

Try these endpoints:

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phoneNumber": "+1234567890",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

All other endpoints work exactly as documented in the main README.

---

**Ready for Production?** See [PRISMA_MIGRATION_GUIDE.md](./PRISMA_MIGRATION_GUIDE.md) for deployment checklist.
