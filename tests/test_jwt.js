const jwt = require('jsonwebtoken');

const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000', role: 'user' }, process.env.JWT_SECRET || 'secret');
console.log(token);
