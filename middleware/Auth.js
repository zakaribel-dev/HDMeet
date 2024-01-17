require('dotenv').config();

const jwt = require('jsonwebtoken');
const authenticateToken = (req, res) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Accès refusé. Token manquant.' });

  jwt.verify(token, process.env.JWT_SECRET, (err) => {
    if (err) return res.status(403).json({ error: 'Accès refusé. Token invalide.' });  //  // token expiré = jme fais déco
  });
};
module.exports = { authenticateToken };