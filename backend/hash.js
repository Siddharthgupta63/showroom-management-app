const bcrypt = require('bcryptjs');

const password = 'Owner2025';

bcrypt.hash(password, 12).then(hash => {
    console.log("Hashed Password:", hash);
});
