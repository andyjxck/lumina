import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userOperations } from '../supabase.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, username, islandName, password, isSupplier = false } = req.body;

    // Check if user exists
    const { data: existingUser } = await userOperations.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data, error } = await userOperations.createUser({
      email,
      username,
      island_name: islandName,
      password: hashedPassword,
      is_supplier: isSupplier
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: data.id, email: data.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: {
        id: data.id,
        email: data.email,
        username: data.username,
        islandName: data.island_name,
        isSupplier: data.is_supplier
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user
    const { data: user, error } = await userOperations.getUserByEmail(email);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        islandName: user.island_name,
        isSupplier: user.is_supplier
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await userOperations.getUserById(decoded.userId);
    
    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      islandName: user.island_name,
      isSupplier: user.is_supplier
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
