const express = require("express");
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => res.send("Node + Python Forgery Check API running"));

const PORT = 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
