const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true, slug: true, status: true }
  });
  console.log(JSON.stringify(businesses, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });