// controllers/authController.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SALT_ROUNDS = 10;

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are all required.',
      });
    }
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          'Username must be 3-30 characters and contain only letters, numbers, and underscores.',
      });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'Email is already registered.' });
    }
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = await User.create({ username, email, passwordHash });
    const user = await User.findById(userId);
    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user,
    });
  } catch (err) {
    console.error('[register] error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findByEmail(email);
    // Use a generic error message for both "no such user" and "wrong
    // password" so we don't leak which emails are registered.
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.is_frozen) {
      return res.status(403).json({
        success: false,
        message: 'This account has been frozen. Please contact support.',
      });
    }

    const token = signToken(user);
    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      coins: user.coins,
      role: user.role,
      created_at: user.created_at,
    };

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error('[login] error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user });
  } catch (err) {
    console.error('[getProfile] error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
};
