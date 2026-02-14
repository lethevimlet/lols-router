const express = require("express");

const router = express.Router();

router.post("/test/model", (req, res) => {
  const model = req.body && req.body.model;
  if (!model) {
    return res.status(400).json({ error: "missing model" });
  }

  global.testModel = model;

  res.json({
    ok: true,
    testModel: global.testModel
  });
});

router.post("/test/model/clear", (req, res) => {
  global.testModel = null;

  res.json({
    ok: true,
    testModel: global.testModel
  });
});

router.get("/test/model", (req, res) => {
  res.json({
    ok: true,
    testModel: global.testModel
  });
});

module.exports = router;
