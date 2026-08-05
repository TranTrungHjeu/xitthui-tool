const express = require("express");
const router = express.Router();
const lessonController = require("../controllers/lessonController");

router.get("/", lessonController.getLessons);
router.get("/:id", lessonController.getLesson);
router.post("/", lessonController.createLesson);
router.put("/:id", lessonController.updateLesson);
router.delete("/:id", lessonController.deleteLesson);

router.get("/:id/qr", lessonController.generateQR);
router.get("/:id/content", lessonController.getContentBlocks);
router.post("/:id/content", lessonController.addContentBlock);
router.put("/content/:contentId", lessonController.updateContentBlock);
router.delete("/content/:contentId", lessonController.deleteContentBlock);

module.exports = router;
