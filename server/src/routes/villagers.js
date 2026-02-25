import express from 'express';
import { villagerOperations } from '../supabase.js';

const router = express.Router();

// Get all villagers
router.get('/', async (req, res) => {
  try {
    const { data, error } = await villagerOperations.getAllVillagers();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get villager by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await villagerOperations.getVillagerById(id);
    
    if (error || !data) {
      return res.status(404).json({ error: 'Villager not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search villagers
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { data, error } = await villagerOperations.searchVillagers(query);
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
