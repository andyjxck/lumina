import express from 'express';
import jwt from 'jsonwebtoken';
import { tradeOperations, villagerOperations, userOperations } from '../supabase.js';

const router = express.Router();

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Create trade request
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { villagerId } = req.body;
    
    // Check if villager exists
    const { data: villager, error: villagerError } = await villagerOperations.getVillagerById(villagerId);
    if (villagerError || !villager) {
      return res.status(404).json({ error: 'Villager not found' });
    }

    // Create trade
    const { data, error } = await tradeOperations.createTrade({
      requester_id: req.userId,
      villager_id: villagerId,
      status: 'PENDING'
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's trades
router.get('/my-trades', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await tradeOperations.getTradesByRequester(req.userId);
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trade queue for a villager
router.get('/queue/:villagerId', async (req, res) => {
  try {
    const { villagerId } = req.params;
    const { data, error } = await tradeOperations.getTradeQueue(villagerId);
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept trade (supplier only)
router.post('/accept/:tradeId', authenticateToken, async (req, res) => {
  try {
    const { tradeId } = req.params;
    
    // Check if user is supplier
    const { data: user } = await userOperations.getUserById(req.userId);
    if (!user.is_supplier) {
      return res.status(403).json({ error: 'Only suppliers can accept trades' });
    }

    const { data, error } = await tradeOperations.acceptTrade(tradeId, req.userId);
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update plot ready status
router.put('/plot-ready/:tradeId', authenticateToken, async (req, res) => {
  try {
    const { tradeId } = req.params;
    const { plotReady } = req.body;

    const { data, error } = await tradeOperations.updateTrade(tradeId, {
      plot_ready: plotReady
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule trade (supplier only)
router.put('/schedule/:tradeId', authenticateToken, async (req, res) => {
  try {
    const { tradeId } = req.params;
    const { scheduledTime, dodoCode } = req.body;

    const { data, error } = await tradeOperations.updateTrade(tradeId, {
      scheduled_time: scheduledTime,
      dodo_code: dodoCode,
      status: 'SCHEDULED'
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete trade
router.post('/complete/:tradeId', authenticateToken, async (req, res) => {
  try {
    const { tradeId } = req.params;

    const { data, error } = await tradeOperations.updateTrade(tradeId, {
      status: 'COMPLETED',
      completed_at: new Date().toISOString()
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending trades (for suppliers)
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await tradeOperations.getPendingTrades();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
