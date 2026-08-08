// Auth routes (Lab 5a): register, login, and session restore.

const express = require('express');
const userController = require('../controllers/userController');
const { validateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/auth', validateToken, userController.auth);

module.exports = router;
