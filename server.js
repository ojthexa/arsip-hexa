const express = require('express');
const path = require('path');
const app = express();
const PORT = 5000;

// Menyajikan file statis dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// Fallback ke index.html untuk Single Page Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server kearsipan berjalan di http://localhost:${PORT}`);
});
