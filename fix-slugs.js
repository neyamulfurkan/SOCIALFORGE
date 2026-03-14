const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.business.update({
    where: { id: 'cmmoski2p0001bvro3rdpp305' },
    data: { slug: 'my-test-store' },
  });
  await prisma.business.delete({
    where: { id: 'cmmot46gh0005rsi4txn6g76u' },
  });
  console.log('Done');
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });