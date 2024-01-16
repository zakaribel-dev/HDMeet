require('dotenv').config();

const jwt = require('jsonwebtoken');
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Accès refusé. Token manquant.' });

  jwt.verify(token, process.env.JW_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Accès refusé. Token invalide.' });
    console.log('Mot de passe haché stocké :', user.password);

    req.user = user;

  });
};
module.exports = { authenticateToken };
