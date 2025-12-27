const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDb() {
    try {
        console.log('Testing database connection...');
        await prisma.$connect();
        console.log('✅ Connected to database');

        const userCount = await prisma.user.count();
        console.log(`✅ Tables exist. Found ${userCount} users.`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Database Error:', error.message);
        if (error.code === 'P2021') {
            console.error('❌ Tables do not exist! You need to run the setup SQL.');
        }
        process.exit(1);
    }
}

checkDb();
