const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SLIDES_PATH = path.join(__dirname, 'public', 'slides.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/slides — returns all slides
app.get('/api/slides', (req, res) => {
  try {
    const data = fs.readFileSync(SLIDES_PATH, 'utf8');
    const slides = JSON.parse(data);
    res.json(slides);
  } catch (err) {
    console.error('Error reading slides.json:', err);
    res.status(500).json({ error: 'Failed to read slides.' });
  }
});

// POST /api/slides — append a new slide
app.post('/api/slides', (req, res) => {
  try {
    const { image, text, type, subtext } = req.body;

    if (!image || !text || !type) {
      return res.status(400).json({ error: 'image, text, and type are required.' });
    }

    const data = fs.readFileSync(SLIDES_PATH, 'utf8');
    const slides = JSON.parse(data);

    const newSlide = {
      id: slides.length > 0 ? slides[slides.length - 1].id + 1 : 1,
      image,
      text,
      type,
      ...(subtext ? { subtext } : {})
    };

    slides.push(newSlide);
    fs.writeFileSync(SLIDES_PATH, JSON.stringify(slides, null, 2), 'utf8');

    res.status(201).json(newSlide);
  } catch (err) {
    console.error('Error writing slides.json:', err);
    res.status(500).json({ error: 'Failed to save slide.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎂 Birthday Slideshow running at http://localhost:${PORT}\n`);
});
