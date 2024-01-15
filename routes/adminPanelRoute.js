const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/Auth");

router.get("/", authenticateToken, (req, res) => {
  res.send("Bienvenue dans votre espace administrateur");
});

module.exports = router; 
