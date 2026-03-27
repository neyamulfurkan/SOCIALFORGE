const bcrypt = require('bcryptjs');

const password = 'YourNewAdminPassword123!'; // Change this to your desired password
const hash = bcrypt.hashSync(password, 10);

console.log('Your new password:', password);
console.log('bcrypt hash:', hash);
console.log('\nCopy this hash to your database:');
console.log(hash);