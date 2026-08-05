const express = require("express");
const router = express.Router();
const {
  getTemplate,
  saveTemplate,
  getRunningClasses,
  getLessonMeta,
  getLessonList,
  getLessonForClass,
} = require("../controllers/zaloController");

router.get("/template", getTemplate);
router.put("/template", saveTemplate);
router.get("/running-classes", getRunningClasses);
router.get("/lesson-meta", getLessonMeta);
router.get("/lessons", getLessonList);
router.get("/lesson-for-class", getLessonForClass);

module.exports = router;
